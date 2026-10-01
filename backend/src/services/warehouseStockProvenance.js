/**
 * warehouseStockProvenance.js
 * Deterministic, evidence-based stock provenance classifier.
 * Shared pure helper for warehouseStore.js and inspect_canex_restore_point.js.
 */

/**
 * Parses and categorizes numerical balances safely.
 * Missing/null/undefined/empty-string defaults to 0.
 * Non-numeric, NaN, or non-finite values are flagged as malformed.
 */
function inspectBalance(data = {}) {
  const parseVal = (val) => {
    if (val === null || val === undefined || val === '') {
      return { num: 0, isInvalid: false, isMissing: true };
    }
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) return { num: val, isInvalid: true, isMissing: false };
      return { num: val, isInvalid: false, isMissing: false };
    }
    const str = String(val).trim();
    if (!str) return { num: 0, isInvalid: false, isMissing: true };
    const parsed = Number(str);
    if (!Number.isFinite(parsed)) return { num: NaN, isInvalid: true, isMissing: false };
    return { num: parsed, isInvalid: false, isMissing: false };
  };

  const b = parseVal(data.quantityBar);
  const l = parseVal(data.quantityLm);
  const k = parseVal(data.quantityKg);

  const hasMalformed = b.isInvalid || l.isInvalid || k.isInvalid;
  const hasNonZero = (b.num !== 0) || (l.num !== 0) || (k.num !== 0);
  const isExactZero = !hasMalformed && !hasNonZero;

  return {
    bar: b.num,
    lm: l.num,
    kg: k.num,
    hasMalformed,
    hasNonZero,
    isExactZero,
  };
}

/**
 * Helper to test if a record is cancelled, rolled back, or deleted.
 */
function isRecordInvalid(rec = {}) {
  const st = String(rec.status || '').toLowerCase();
  return Boolean(
    rec.isCancelled ||
    st === 'cancelled' ||
    rec.isDeleted ||
    st === 'deleted' ||
    rec.isRolledBack ||
    st === 'rolled_back' ||
    rec.isReversed ||
    st === 'reversed'
  );
}

/**
 * Builds an index of verified transaction evidence from movements and invoices.
 * Single-pass: reads current generation records once per operation.
 * Invalidates cancelled, rolled-back, or deleted movements and invoices.
 */
function buildEvidenceIndex({ movements = [], invoices = [] } = {}) {
  // Deduplicate and index unique invoices by their authoritative document id
  const uniqueInvoices = new Map();
  for (const inv of invoices) {
    const id = String(inv.id || '').trim();
    if (id) {
      uniqueInvoices.set(id, inv);
    }
  }

  const invalidInvoiceIds = new Set();
  const invalidInvoiceNumbers = new Set();
  const invoiceNumberCounts = new Map();
  const validInboundInvoices = [];
  const validOutboundInvoices = [];

  for (const [id, inv] of uniqueInvoices.entries()) {
    const num = String(inv.invoiceNumber || '').trim();
    if (num) invoiceNumberCounts.set(num, (invoiceNumberCounts.get(num) || 0) + 1);
    if (isRecordInvalid(inv)) {
      invalidInvoiceIds.add(id);
      if (num) invalidInvoiceNumbers.add(num);
    } else if (inv.movementType === 'inbound') {
      validInboundInvoices.push(inv);
    } else if (inv.movementType === 'outbound') {
      validOutboundInvoices.push(inv);
    }
  }

  const index = new Map();

  const getEntry = (key) => {
    if (!index.has(key)) {
      index.set(key, {
        inboundMovements: 0,
        outboundMovements: 0,
        inboundInvoiceLines: 0,
        outboundInvoiceLines: 0,
        hasInitialImport: false,
        hasConflictingEvidence: false,
        validOutboundInvoicesWithKey: [], // array of { id, invoiceNumber, createdAt }
      });
    }
    return index.get(key);
  };

  // Inspect movements with movement-level and linked-invoice invalidation
  for (const m of movements) {
    const key = String(m.itemKey || '').trim();
    if (!key) continue;

    if (isRecordInvalid(m)) continue;

    const mInvId = String(m.invoiceId || '').trim();
    const mInvNum = String(m.invoiceNumber || '').trim();
    if (mInvId && invalidInvoiceIds.has(mInvId)) continue;
    if (!mInvId && (invoiceNumberCounts.get(mInvNum) || 0) > 1) {
      getEntry(key).hasConflictingEvidence = true;
      continue;
    }
    if (!mInvId && mInvNum && invalidInvoiceNumbers.has(mInvNum)) continue;

    const entry = getEntry(key);
    const mvtType = String(m.movementType || '').toLowerCase();
    const srcType = String(m.sourceType || '').toLowerCase();

    if (mvtType === 'inbound') {
      entry.inboundMovements++;
      if (
        srcType === 'initial_import' ||
        srcType === 'manual_inbound' ||
        srcType === 'opening_balance' ||
        srcType === 'stock_intake'
      ) {
        entry.hasInitialImport = true;
      }
    } else if (mvtType === 'outbound') {
      entry.outboundMovements++;
    }
  }

  // Scan unique inbound invoice lines once
  for (const inv of validInboundInvoices) {
    const lines = Array.isArray(inv.lines) ? inv.lines : (Array.isArray(inv.items) ? inv.items : []);
    for (const line of lines) {
      const key = String(line.itemKey || '').trim();
      if (key) {
        getEntry(key).inboundInvoiceLines++;
      }
    }
  }

  // Scan unique outbound invoice lines once
  for (const inv of validOutboundInvoices) {
    const lines = Array.isArray(inv.lines) ? inv.lines : (Array.isArray(inv.items) ? inv.items : []);
    const invId = String(inv.id || '').trim();
    const invNum = String(inv.invoiceNumber || '').trim();
    const invCreated = inv.createdAt ? new Date(inv.createdAt).getTime() : null;

    for (const line of lines) {
      const key = String(line.itemKey || '').trim();
      if (key) {
        const e = getEntry(key);
        e.outboundInvoiceLines++;
        e.validOutboundInvoicesWithKey.push({
          id: invId,
          invoiceNumber: invNum,
          createdAt: invCreated,
        });
      }
    }
  }

  return index;
}

/**
 * Classifies a stock document with conservative retention rules.
 *
 * Rules:
 * 1. Non-zero, negative, or malformed balance -> RETAIN.
 * 2. Exact-zero with verified inbound origin (inbound movement, invoice line, or initial import) -> RETAIN.
 * 3. Exact-zero with affirmative birth evidence of exclusive outbound origin -> EXCLUDE.
 *    - Requires positive valid outbound evidence (non-cancelled outbound movement or invoice line).
 *    - AND requires affirmative birth evidence: explicit origin metadata OR verified immutable createdAt
 *      correlated with an actual valid outbound invoice that contains this exact itemKey.
 *    - Fallbacks using updatedAt or movement time alone are STRICTLY PROHIBITED.
 * 4. Ambiguous / missing birth evidence -> RETAIN (UNKNOWN conservative preservation).
 */
function classifyStockItem(stockDoc = {}, evidenceIndex = new Map()) {
  const itemKey = String(stockDoc.itemKey || stockDoc.id || '').trim();
  const balance = inspectBalance(stockDoc);

  // Invariant 1: Always retain non-zero, negative, or malformed balances
  if (!balance.isExactZero) {
    return {
      status: 'RETAIN',
      reason: balance.hasMalformed ? 'MALFORMED_BALANCE' : 'NON_ZERO_BALANCE',
      balance,
    };
  }

  const evidence = evidenceIndex.get(itemKey);
  if (evidence?.hasConflictingEvidence) {
    return { status: 'RETAIN', reason: 'UNKNOWN_CONSERVATIVE_RETAIN', balance };
  }

  // Invariant 2: Retain legitimate depleted items that have confirmed inbound origin
  const hasInboundOrigin = Boolean(
    evidence && (
      evidence.inboundMovements > 0 ||
      evidence.inboundInvoiceLines > 0 ||
      evidence.hasInitialImport
    )
  );

  if (hasInboundOrigin) {
    return {
      status: 'RETAIN',
      reason: 'LEGITIMATE_DEPLETED_INBOUND',
      balance,
    };
  }

  // Invariant 3: Affirmative Birth Evidence Check
  // All-outbound history alone is NOT proof of creation; initial/manual stock may have no inbound ledger.
  // Artifact exclusion requires affirmative birth evidence:
  // Must have verified positive valid outbound evidence (cannot be from cancelled/rolled-back outbound).
  const hasValidOutboundEvidence = Boolean(
    evidence && (
      evidence.outboundMovements > 0 ||
      evidence.outboundInvoiceLines > 0
    )
  );

  if (!hasValidOutboundEvidence) {
    // No inbound and no valid outbound -> unknown origin (e.g. static opening record with 0 balance).
    return {
      status: 'RETAIN',
      reason: 'UNKNOWN_CONSERVATIVE_RETAIN',
      balance,
    };
  }

  let hasAffirmativeBirth = false;

  // Option A: Explicit origin metadata on stock document
  const originMeta = String(stockDoc.createdFrom || stockDoc.originType || '').toLowerCase();
  const isExplicitMeta = originMeta === 'outbound' || originMeta === 'outbound_artifact' || stockDoc.spawnedFromOutbound === true;

  if (isExplicitMeta) {
    // Valid affirmative birth because valid outbound evidence exists
    hasAffirmativeBirth = true;
  } else if (stockDoc.createdAt && evidence && Array.isArray(evidence.validOutboundInvoicesWithKey) && evidence.validOutboundInvoicesWithKey.length > 0) {
    // Option B: True immutable createdAt correlated with a valid linked outbound invoice with matching itemKey
    const docCreatedTime = new Date(stockDoc.createdAt).getTime();
    if (!isNaN(docCreatedTime)) {
      for (const outInv of evidence.validOutboundInvoicesWithKey) {
        if (outInv.createdAt && Math.abs(docCreatedTime - outInv.createdAt) <= 5000) {
          hasAffirmativeBirth = true;
          break;
        }
      }
    }
  }

  // NOTE: updatedAt correlation and movement-time-alone correlation are strictly prohibited.
  // If affirmative birth evidence is present:
  if (hasAffirmativeBirth) {
    return {
      status: 'EXCLUDE',
      reason: 'PROVEN_OUTBOUND_ARTIFACT',
      balance,
    };
  }

  // Invariant 4: Conservative fallback - preserve unknown records (e.g. legacy opening stock depleted outbound)
  return {
    status: 'RETAIN',
    reason: 'UNKNOWN_CONSERVATIVE_RETAIN',
    balance,
  };
}

module.exports = {
  inspectBalance,
  isRecordInvalid,
  buildEvidenceIndex,
  classifyStockItem,
};
