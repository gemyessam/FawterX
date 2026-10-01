#!/usr/bin/env node
/**
 * inspect_canex_restore_point.js
 * Read-only inspection tool for warehouse restore points and active stock provenance.
 *
 * Guaranteed Safe & Read-Only:
 * - NO database mutations
 * - NO automated recovery actions
 * - NO customer content or credentials output (only SKU IDs, balances, and provenance status)
 * - Bounded decompression (256MB max) and SHA-256 checksum verification
 */

const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { COLLECTIONS } = require('../src/services/warehousePersistence');
const { classifyStockItem, buildEvidenceIndex, inspectBalance } = require('../src/services/warehouseStockProvenance');

const digest = (data) => createHash('sha256').update(data).digest('hex');

function validateProjectId(id) {
  if (typeof id !== 'string' || !id.trim() || id.includes('/') || id.trim() === '.' || id.trim() === '..' || /[\r\n\x00-\x1f]/.test(id) || Buffer.byteLength(id) > 1500) {
    throw new Error('Invalid warehouse project ID');
  }
  return id.trim();
}

/**
 * Pure decoder for Tagged values (matching warehouseSnapshots.js)
 */
function decodeTaggedNode(node, depth = 0) {
  if (depth > 100 || !Array.isArray(node) || node.length < 2) throw new Error('Invalid snapshot value');
  const [tag, value, second] = node;
  switch (tag) {
    case 'scalar': return value;
    case 'number': return Number(value);
    case 'bytes': return Buffer.from(value, 'base64');
    case 'date': return new Date(value);
    case 'timestamp': return { seconds: value, nanoseconds: second };
    case 'geo': return { latitude: value, longitude: second };
    case 'ref': return { path: value };
    case 'array':
      if (!Array.isArray(value)) throw new Error('Invalid snapshot array');
      return value.map(v => decodeTaggedNode(v, depth + 1));
    case 'map': {
      if (!Array.isArray(value) || value.some(e => !Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string')) throw new Error('Invalid snapshot map');
      if (new Set(value.map(e => e[0])).size !== value.length) throw new Error('Duplicate snapshot field');
      return Object.fromEntries(value.map(([k, v]) => [k, decodeTaggedNode(v, depth + 1)]));
    }
    default: throw new Error('Unsupported snapshot value');
  }
}

/**
 * Pure extraction and provenance classification on in-memory collections.
 * Returns only SKU technical identities, physical quantities, and provenance verdicts.
 */
function extractStockInspection({ stock = [], deletedStock = [], movements = [], invoices = [] } = {}) {
  const tombstones = new Set(deletedStock.map(d => String(d.id || d.itemKey || '').trim()).filter(Boolean));
  const evidenceIndex = buildEvidenceIndex({ movements, invoices });

  const rows = [];
  const summary = {
    totalStockRows: stock.length,
    tombstonedInDeletedStock: 0,
    nonZeroOrMalformedRetained: 0,
    legitimateDepletedRetained: 0,
    unknownConservativeRetained: 0,
    provenOutboundArtifactsExcluded: 0,
    totalVisibleInStock: 0,
    totalBars: 0,
    totalLm: 0,
    totalKg: 0,
  };

  for (const doc of stock) {
    const itemKey = String(doc.id || doc.itemKey || '').trim();
    const isTombstoned = tombstones.has(itemKey);

    if (isTombstoned) {
      summary.tombstonedInDeletedStock++;
    }

    const stockDoc = { ...doc, itemKey };
    const classification = classifyStockItem(stockDoc, evidenceIndex);
    const balance = classification.balance || inspectBalance(stockDoc);

    const isVisible = !isTombstoned && classification.status === 'RETAIN';

    if (isVisible) {
      summary.totalVisibleInStock++;
      if (Number.isFinite(balance.bar)) summary.totalBars += balance.bar;
      if (Number.isFinite(balance.lm)) summary.totalLm += balance.lm;
      if (Number.isFinite(balance.kg)) summary.totalKg += balance.kg;

      if (classification.reason === 'NON_ZERO_BALANCE' || classification.reason === 'MALFORMED_BALANCE') {
        summary.nonZeroOrMalformedRetained++;
      } else if (classification.reason === 'LEGITIMATE_DEPLETED_INBOUND') {
        summary.legitimateDepletedRetained++;
      } else if (classification.reason === 'UNKNOWN_CONSERVATIVE_RETAIN') {
        summary.unknownConservativeRetained++;
      }
    } else if (classification.status === 'EXCLUDE') {
      summary.provenOutboundArtifactsExcluded++;
    }

    rows.push({
      itemKey,
      itemCode: doc.itemCode || doc.internalCode || '',
      finish: doc.finish || doc.color || '',
      lengthMm: Number(doc.lengthMm || doc.length || 0),
      quantityBar: balance.bar,
      quantityLm: balance.lm,
      quantityKg: balance.kg,
      isTombstoned,
      status: classification.status,
      reason: classification.reason,
      isVisible,
    });
  }

  summary.totalBars = Number(summary.totalBars.toFixed(2));
  summary.totalLm = Number(summary.totalLm.toFixed(2));
  summary.totalKg = Number(summary.totalKg.toFixed(2));

  return { summary, rows };
}

/**
 * Reconstitutes and unpacks a restore point document (supporting both Legacy and Schema 2).
 */
function unpackRestorePoint(pointData = {}, chunkDocs = [], expectedProjectId = pointData.projectId) {
  if (pointData.schemaVersion === 2) {
    if (pointData.status !== 'complete') {
      throw new Error(`Incomplete restore point (status: ${pointData.status})`);
    }
    const expectedChunks = Number(pointData.chunks || 0);
    if (!Number.isInteger(expectedChunks) || expectedChunks < 1 || chunkDocs.length !== expectedChunks) {
      throw new Error(`Incomplete chunk set: expected ${expectedChunks}, received ${chunkDocs.length}`);
    }

    const byId = new Map(chunkDocs.map(c => [String(c.id), c.bytes || c.data?.bytes]));
    const parts = [];
    for (let i = 0; i < expectedChunks; i++) {
      const part = byId.get(String(i));
      if (!Buffer.isBuffer(part)) {
        throw new Error(`Missing or invalid chunk ${i}`);
      }
      parts.push(part);
    }

    const compressed = Buffer.concat(parts);
    if (compressed.length !== pointData.compressedBytes) {
      throw new Error(`Compressed bytes mismatch: expected ${pointData.compressedBytes}, got ${compressed.length}`);
    }
    if (digest(compressed) !== pointData.checksum) {
      throw new Error(`Checksum mismatch on restore point ${pointData.id || ''}`);
    }

    // Bounded decompression: max 256MB
    const decompressed = gunzipSync(compressed, { maxOutputLength: 256 * 1024 * 1024 });
    const parsedJson = JSON.parse(decompressed.toString('utf-8'));
    const decoded = decodeTaggedNode(parsedJson);

    if (decoded.schemaVersion !== 2 || !expectedProjectId || decoded.projectId !== expectedProjectId || pointData.projectId !== expectedProjectId) throw new Error('Snapshot project or schema mismatch');
    const cols = decoded.collections;
    if (!cols || typeof cols !== 'object') throw new Error('Missing snapshot collections');
    for (const name of COLLECTIONS) {
      const entries = cols[name];
      if (!Array.isArray(entries) || entries.length !== pointData.collectionCounts?.[name]) throw new Error('Snapshot collection count mismatch');
      const ids = new Set();
      for (const entry of entries) {
        validateProjectId(entry.id);
        if (ids.has(entry.id) || !entry.data || typeof entry.data !== 'object' || Array.isArray(entry.data)) throw new Error('Invalid snapshot document');
        ids.add(entry.id);
      }
    }
    const records = name => cols[name].map(e => ({ ...e.data, id: e.id, ...(name === 'stock' ? { itemKey: e.id } : {}) }));
    return {
      schemaVersion: 2,
      pointName: pointData.name || '',
      createdAt: pointData.createdAt || '',
      stock: records('stock'),
      deletedStock: records('deletedStock'),
      movements: records('movements'),
      invoices: records('invoices'),
    };
  }

  if ((pointData.schemaVersion !== undefined && pointData.schemaVersion !== 1) || !Array.isArray(pointData.stockSnapshot)) throw new Error('Unsupported snapshot schema');
  // Legacy snapshot schema
  const stockSnapshot = Array.isArray(pointData.stockSnapshot) ? pointData.stockSnapshot : [];
  const deletedSnapshot = Array.isArray(pointData.deletedStockSnapshot) ? pointData.deletedStockSnapshot : [];
  const movementsSnapshot = Array.isArray(pointData.movementsSnapshot) ? pointData.movementsSnapshot : [];
  const invoicesSnapshot = Array.isArray(pointData.invoicesSnapshot) ? pointData.invoicesSnapshot : [];

  return {
    schemaVersion: 1,
    pointName: pointData.name || 'Legacy Snapshot',
    createdAt: pointData.createdAt || '',
    stock: stockSnapshot,
    deletedStock: deletedSnapshot,
    movements: movementsSnapshot,
    invoices: invoicesSnapshot,
  };
}

/**
 * Formats inspection output cleanly without exposing customer names or financials.
 */
function formatInspectionOutput({ projectId, targetDescription, inspection }) {
  const { summary, rows } = inspection;
  const lines = [];

  lines.push(`========================================================================`);
  lines.push(`READ-ONLY WAREHOUSE STOCK INSPECTION REPORT`);
  lines.push(`Project: ${projectId}`);
  lines.push(`========================================================================`);
  lines.push(``);
  lines.push(`SUMMARY METRICS:`);
  lines.push(`- Total Stock Rows:                 ${summary.totalStockRows}`);
  lines.push(`- Visible Active SKUs:              ${summary.totalVisibleInStock}`);
  lines.push(`  * Non-Zero / Malformed Retained:   ${summary.nonZeroOrMalformedRetained}`);
  lines.push(`  * Legitimate Depleted Inbound:     ${summary.legitimateDepletedRetained}`);
  lines.push(`  * UNKNOWN Preserved:               ${summary.unknownConservativeRetained}`);
  lines.push(`- Proven Outbound Artifacts (Excl): ${summary.provenOutboundArtifactsExcluded}`);
  lines.push(`- Tombstoned in deletedStock:       ${summary.tombstonedInDeletedStock}`);
  lines.push(`- Total Physical Quantities:        ${summary.totalBars} BAR | ${summary.totalLm} LM | ${summary.totalKg} KG`);
  lines.push(``);
  lines.push(`DETAILED SKU CLASSIFICATION (Top entries):`);
  lines.push(`------------------------------------------------------------------------`);
  lines.push(`Item Key | Item Code | Finish | Bars | LM | KG | Status | Reason`);
  lines.push(`------------------------------------------------------------------------`);

  for (const r of rows) {
    const safe = val => JSON.stringify(String(val ?? ''));
    const key = safe(r.itemKey);
    const fin = safe(r.finish || 'RAW');
    const bar = String(r.quantityBar).padStart(4);
    const lm = String(r.quantityLm).padStart(5);
    const st = r.isVisible ? 'VIS' : 'HID';
    const rsn = r.reason || '';
    lines.push(`${key} | ${safe(r.itemCode)} | ${fin} | ${bar} | ${lm} | ${r.quantityKg} | ${st} | ${rsn}`);
  }
  lines.push(`========================================================================`);

  return lines.join('\n');
}

/**
 * Main CLI execution
 */
function parseArgs(args) {
  let projectId = null;
  let pointId = null;
  let inspectActive = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1] && !projectId) {
      projectId = args[++i];
    } else if (args[i] === '--point' && args[i + 1] && !pointId) {
      pointId = args[++i];
    } else if (args[i] === '--active' && !inspectActive) {
      inspectActive = true;
    } else {
      throw new Error('Use --project <id> with exactly one of --point <id> or --active');
    }
  }

  projectId = validateProjectId(projectId);
  if (Boolean(pointId) === inspectActive) throw new Error('Choose exactly one inspection target');
  if (pointId) pointId = validateProjectId(pointId);
  return { projectId, pointId, inspectActive };
}

async function main() {
  const { projectId, pointId } = parseArgs(process.argv.slice(2));

  let admin;
  try {
    admin = require('../src/services/firebaseAdmin');
  } catch (err) {
    console.error('Firebase Admin SDK unavailable.');
    process.exit(1);
  }

  const db = admin.firestore();
  const projectRef = db.collection('warehouseProjects').doc(projectId);
  const pDoc = await projectRef.get();
  if (!pDoc.exists) {
    console.error(`Warehouse project "${projectId}" not found.`);
    process.exit(1);
  }

  const pData = pDoc.data() || {};
  let collectionsToInspect;

  if (pointId) {
    const pointRef = projectRef.collection('restorePoints').doc(pointId);
    const ptDoc = await pointRef.get();
    if (!ptDoc.exists) {
      console.error(`Restore point "${pointId}" not found in project "${projectId}".`);
      process.exit(1);
    }
    const ptData = ptDoc.data() || {};
    const chunksSnap = await pointRef.collection('chunks').get();
    const chunkDocs = chunksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    collectionsToInspect = unpackRestorePoint({ ...ptData, id: pointId }, chunkDocs, projectId);
  } else {
    // Active state inspection
    const activeGen = pData.activeGeneration;
    if (activeGen) validateProjectId(activeGen);
    const root = activeGen ? projectRef.collection('generations').doc(activeGen) : projectRef;

    const [stockSnap, delSnap, mvtSnap, invSnap] = await Promise.all([
      root.collection('stock').get(),
      root.collection('deletedStock').get(),
      root.collection('movements').get(),
      root.collection('invoices').get(),
    ]);

    collectionsToInspect = {
      pointName: `Active State (Generation: ${activeGen || 'root'})`,
      stock: stockSnap.docs.map(d => ({ ...d.data(), id: d.id, itemKey: d.id })),
      deletedStock: delSnap.docs.map(d => ({ ...d.data(), id: d.id })),
      movements: mvtSnap.docs.map(d => ({ ...d.data(), id: d.id })),
      invoices: invSnap.docs.map(d => ({ ...d.data(), id: d.id })),
    };
  }

  const inspection = extractStockInspection(collectionsToInspect);
  const report = formatInspectionOutput({
    projectId,
    targetDescription: collectionsToInspect.pointName,
    inspection,
  });

  console.log(report);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Inspection failed. Verify target IDs, credentials and snapshot integrity.');
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  validateProjectId,
  decodeTaggedNode,
  unpackRestorePoint,
  extractStockInspection,
  formatInspectionOutput,
};
