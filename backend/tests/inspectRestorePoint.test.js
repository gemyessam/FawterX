const { gzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const {
  validateProjectId,
  parseArgs,
  decodeTaggedNode,
  unpackRestorePoint,
  extractStockInspection,
  formatInspectionOutput,
} = require('../scripts/inspect_canex_restore_point');
const { encode } = require('../src/services/warehouseSnapshots');
const { COLLECTIONS } = require('../src/services/warehousePersistence');

const digest = (data) => createHash('sha256').update(data).digest('hex');

describe('inspect_canex_restore_point (Pure Read-Only Inspector)', () => {

  function schema2Fixture(stock = []) {
    const collections = Object.fromEntries(COLLECTIONS.map(name => [name, []]));
    collections.stock = stock;
    const payload = { schemaVersion: 2, projectId: 'canex_wh', collections };
    return { payload, manifest: {
      schemaVersion: 2, projectId: 'canex_wh', status: 'complete',
      collectionCounts: Object.fromEntries(COLLECTIONS.map(name => [name, collections[name].length])),
    } };
  }

  function packFixture({ payload, manifest }) {
    const bytes = gzipSync(Buffer.from(JSON.stringify(encode(payload))));
    return [{ ...manifest, chunks: 1, compressedBytes: bytes.length, checksum: digest(bytes) }, [{ id: '0', bytes }]];
  }

  test('preserves authoritative schema2 document identity when data has no itemKey or id', () => {
    const fixture = schema2Fixture([{ id: 'REAL-SKU', data: { quantityBar: 12 } }]);
    const inspection = extractStockInspection(unpackRestorePoint(...packFixture(fixture)));
    expect(inspection.rows[0].itemKey).toBe('REAL-SKU');
    expect(inspection.summary.totalBars).toBe(12);
  });

  test('schema2 payload fields cannot forge document identity or bypass a tombstone', () => {
    const fixture = schema2Fixture([{ id: 'REAL-SKU', data: { id: 'FORGED', itemKey: 'FORGED', quantityBar: 12 } }]);
    fixture.payload.collections.deletedStock = [{ id: 'REAL-SKU', data: { id: 'FORGED-DELETE', itemKey: 'FORGED-DELETE' } }];
    fixture.manifest.collectionCounts.deletedStock = 1;
    const inspection = extractStockInspection(unpackRestorePoint(...packFixture(fixture)));
    expect(inspection.rows[0].itemKey).toBe('REAL-SKU');
    expect(inspection.rows[0].isTombstoned).toBe(true);
    expect(inspection.summary.totalVisibleInStock).toBe(0);
  });

  test.each(['payload project', 'manifest project', 'payload schema'])('rejects %s mismatch rather than returning misleading empty stock', mutation => {
    const fixture = schema2Fixture();
    if (mutation === 'payload project') fixture.payload.projectId = 'other';
    if (mutation === 'manifest project') fixture.manifest.projectId = 'other';
    if (mutation === 'payload schema') fixture.payload.schemaVersion = 3;
    expect(() => unpackRestorePoint(...packFixture(fixture))).toThrow();
  });

  test.each(['absent counts', 'missing count', 'wrong count', 'missing collection'])('rejects an incomplete manifest or payload: %s', mutation => {
    const fixture = schema2Fixture();
    if (mutation === 'absent counts') delete fixture.manifest.collectionCounts;
    if (mutation === 'missing count') delete fixture.manifest.collectionCounts.items;
    if (mutation === 'wrong count') fixture.manifest.collectionCounts.stock = 1;
    if (mutation === 'missing collection') delete fixture.payload.collections.items;
    expect(() => unpackRestorePoint(...packFixture(fixture))).toThrow();
  });

  test('rejects unsupported snapshot schemas and unknown tagged values', () => {
    expect(() => unpackRestorePoint({ schemaVersion: 3 })).toThrow();
    expect(() => decodeTaggedNode(['future-type', { collections: {} }])).toThrow();
  });

  test('prints complete long SKU keys and item codes for reconciliation', () => {
    const itemKey = 'CANEX-VERY-LONG-AUTHORITATIVE-SKU-IDENTITY-6000';
    const itemCode = 'ITEM-CODE-FOR-EXACT-PDF-RECONCILIATION';
    const inspection = extractStockInspection({ stock: [{ itemKey, itemCode, quantityBar: 4 }] });
    const output = formatInspectionOutput({ projectId: 'canex_wh', targetDescription: 'fixture', inspection });
    expect(output).toContain(itemKey);
    expect(output).toContain(itemCode);
  });

  test.each([
    [], ['--active'], ['--project', 'canex_wh'],
    ['--project', 'canex_wh', '--active', '--point', 'point-1'],
    ['--project', 'canex_wh', '--point'],
    ['--project', '--active'],
    ['--project', 'canex_wh', '--active', '--typo'],
    ['--project', 'canex_wh', '--active', '--project', 'other'],
    ['--project', 'canex_wh', '--point', '../point'],
  ].map(args => [args]))('rejects ambiguous or invalid explicit CLI selection %j', args => {
    expect(typeof parseArgs).toBe('function');
    expect(() => parseArgs(args)).toThrow();
  });

  test('parses explicit project with exactly one active or restore-point target', () => {
    expect(parseArgs(['--project', 'canex_wh', '--active'])).toMatchObject({ projectId: 'canex_wh', inspectActive: true, pointId: null });
    expect(parseArgs(['--project', 'canex_wh', '--point', 'point-1'])).toMatchObject({ projectId: 'canex_wh', inspectActive: false, pointId: 'point-1' });
  });

  test('validates project ID and rejects invalid characters or path traversals', () => {
    expect(validateProjectId('canex_wh')).toBe('canex_wh');
    expect(validateProjectId(' default_canex ')).toBe('default_canex');

    expect(() => validateProjectId('')).toThrow('Invalid warehouse project ID');
    expect(() => validateProjectId('project/with/slash')).toThrow('Invalid warehouse project ID');
    expect(() => validateProjectId('..')).toThrow('Invalid warehouse project ID');
    expect(() => validateProjectId('.')).toThrow('Invalid warehouse project ID');
  });

  test('extracts pure stock inspection from legacy snapshot payload without network', () => {
    const legacyPoint = {
      name: 'Legacy Auto Snapshot',
      createdAt: '2026-09-25T10:00:00Z',
      stockSnapshot: [
        { itemKey: 'CANEX-P1-MF-6000', quantityBar: 10, quantityLm: 60, quantityKg: 20 },
        { itemKey: 'CANEX-P2-MF-6000', quantityBar: 0, quantityLm: 0, quantityKg: 0 },
      ],
      deletedStockSnapshot: [],
      movementsSnapshot: [
        { itemKey: 'CANEX-P2-MF-6000', movementType: 'inbound', createdAt: '2026-09-20T10:00:00Z' },
      ],
      invoicesSnapshot: [],
    };

    const unpacked = unpackRestorePoint(legacyPoint);
    expect(unpacked.schemaVersion).toBe(1);
    expect(unpacked.stock).toHaveLength(2);

    const inspection = extractStockInspection(unpacked);
    expect(inspection.summary.totalStockRows).toBe(2);
    expect(inspection.summary.totalVisibleInStock).toBe(2);
    expect(inspection.summary.nonZeroOrMalformedRetained).toBe(1);
    expect(inspection.summary.legitimateDepletedRetained).toBe(1);
  });

  test('unpacks and verifies Schema Version 2 chunked snapshot with SHA-256 validation', () => {
    const payload = {
      schemaVersion: 2,
      projectId: 'test_proj',
      metadata: { name: 'Test' },
      collections: {
        stock: [
          { id: 'SKU-1', data: { itemKey: 'SKU-1', finish: 'MF', quantityBar: 50, quantityLm: 300 } },
          { id: 'SKU-2', data: { itemKey: 'SKU-2', finish: 'MF', quantityBar: 0, quantityLm: 0 } },
        ],
        deletedStock: [],
        movements: [
          { id: 'm1', data: { itemKey: 'SKU-2', movementType: 'inbound' } },
        ],
        invoices: [],
      },
    };

    for (const name of COLLECTIONS) payload.collections[name] ||= [];
    const encoded = Buffer.from(JSON.stringify(encode(payload)));
    const compressed = gzipSync(encoded);
    const checksum = digest(compressed);

    const CHUNK_SIZE = 1000;
    const chunkCount = Math.ceil(compressed.length / CHUNK_SIZE);
    const chunkDocs = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkDocs.push({
        id: String(i),
        bytes: compressed.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      });
    }

    const pointData = {
      id: 'point-123',
      projectId: payload.projectId,
      collectionCounts: Object.fromEntries(COLLECTIONS.map(name => [name, payload.collections[name].length])),
      name: 'Schema 2 Backup',
      schemaVersion: 2,
      status: 'complete',
      chunks: chunkCount,
      compressedBytes: compressed.length,
      checksum,
    };

    const unpacked = unpackRestorePoint(pointData, chunkDocs);
    expect(unpacked.schemaVersion).toBe(2);
    expect(unpacked.stock).toHaveLength(2);

    const inspection = extractStockInspection(unpacked);
    expect(inspection.summary.totalVisibleInStock).toBe(2);
    expect(inspection.summary.totalBars).toBe(50);
  });

  test('rejects corrupted checksum or missing chunks in Schema 2 restore point', () => {
    const compressed = gzipSync(Buffer.from(JSON.stringify(encode({ collections: {} }))));
    const pointData = {
      id: 'point-bad',
      schemaVersion: 2,
      status: 'complete',
      chunks: 2,
      compressedBytes: compressed.length,
      checksum: 'bad_checksum_hash',
    };

    // Missing chunks count mismatch
    expect(() => unpackRestorePoint(pointData, [{ id: '0', bytes: compressed }])).toThrow('Incomplete chunk set');

    // Corrupted checksum
    const chunkDocs = [
      { id: '0', bytes: compressed.subarray(0, 10) },
      { id: '1', bytes: compressed.subarray(10) },
    ];
    expect(() => unpackRestorePoint(pointData, chunkDocs)).toThrow('Checksum mismatch');
  });

  test('formatting output contains strictly technical SKU rows and zero customer/credential data', () => {
    const inspection = {
      summary: {
        totalStockRows: 2,
        tombstonedInDeletedStock: 0,
        nonZeroOrMalformedRetained: 1,
        legitimateDepletedRetained: 1,
        unknownConservativeRetained: 0,
        provenOutboundArtifactsExcluded: 0,
        totalVisibleInStock: 2,
        totalBars: 15,
        totalLm: 90,
        totalKg: 30,
      },
      rows: [
        {
          itemKey: 'CANEX-346980-MF-6000',
          itemCode: '346980',
          finish: 'MF',
          lengthMm: 6000,
          quantityBar: 15,
          quantityLm: 90,
          quantityKg: 30,
          isVisible: true,
          reason: 'NON_ZERO_BALANCE',
        },
      ],
    };

    const output = formatInspectionOutput({
      projectId: 'CANEX_WH',
      targetDescription: 'Pre-SD Restore Point',
      inspection,
    });

    expect(output).toContain('READ-ONLY WAREHOUSE STOCK INSPECTION REPORT');
    expect(output).toContain('CANEX-346980-MF-6000');
    expect(output).toContain('15 BAR');
    expect(output).not.toContain('customer');
    expect(output).not.toContain('Sotalux');
    expect(output).not.toContain('client');
    expect(output).not.toContain('password');
    expect(output).not.toContain('secret');
  });
});
