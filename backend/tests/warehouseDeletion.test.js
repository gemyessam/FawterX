const { createFirestore } = require('./helpers/warehouseFirestore');
let mockDb;
const mockFirestore = Object.assign(() => mockDb, { FieldValue: {
  increment: value => ({ __operation: 'increment', value }),
  arrayUnion: (...value) => ({ __operation: 'arrayUnion', value }),
  arrayRemove: (...value) => ({ __operation: 'arrayRemove', value }),
}});
jest.mock('../src/services/firebaseAdmin', () => ({ apps: [{}], firestore: mockFirestore }));
const store = require('../src/services/warehouseStore');
const parent = 'warehouseProjects/a';
const zero = { itemKey: 'sku', itemCode: 'SKU', description: 'Zero fixture', finish: 'MF', lengthMm: 6000, quantityBar: 0, quantityLm: 0, quantityKg: 0 };
const line = quantityBar => ({ ...zero, quantityBar, quantityLm: quantityBar * 6, unitPrice: 2, barPrice: 12, netTotal: quantityBar * 12 });
beforeEach(() => { mockDb = createFirestore({ [parent]: { name: 'A', code: 'CANEX', status: 'active' }, [parent + '/stock/sku']: zero }); });

async function deleteAndFence() {
  await store.deleteStockItem('a', 'sku', 'admin');
  const fence = mockDb.rows.get(parent + '/items/sku')?.stockHistoryDeletedBefore;
  expect(typeof fence).toBe('string');
  expect(Number.isFinite(Date.parse(fence))).toBe(true);
  return fence;
}

test('exact-zero manual deletion is bounded with 500 movements and preserves full stock backup and other stock', async () => {
  mockDb.rows.set(parent + '/stock/other', { ...line(7), itemKey: 'other' });
  for (let i = 0; i < 500; i++) mockDb.rows.set(parent + '/movements/m' + i, { itemKey: 'sku', movementType: 'inbound', createdAt: '2020-01-01T00:00:00Z' });
  const result = await store.deleteStockItem('a', 'sku', 'admin');
  expect(result.deleted).toBe(true);
  expect(mockDb.rows.has(parent + '/stock/sku')).toBe(false);
  expect(mockDb.rows.get(parent + '/stock/other').quantityBar).toBe(7);
  expect(mockDb.rows.get(parent + '/deletedStock/sku').stockSnapshot).toEqual(zero);
  expect(mockDb.rows.get(parent + '/items/sku').stockHistoryDeletedBefore).toEqual(expect.any(String));
  expect(mockDb.rows.get(parent + '/movements/m0').isDeleted).toBeUndefined();
  expect([...mockDb.rows.keys()].some(key => key.includes('/restorePoints/'))).toBe(false);
  expect([...mockDb.rows.entries()].some(([key, value]) => key.includes('/auditLogs/') && value.action === 'DELETE_STOCK_ITEM')).toBe(true);
});

test('failed deletion commit leaves stock, tombstone, fence and audit untouched', async () => {
  const before = JSON.stringify([...mockDb.rows]);
  mockDb.failCommit = true;
  await expect(store.deleteStockItem('a', 'sku', 'admin')).rejects.toThrow('injected');
  expect(JSON.stringify([...mockDb.rows])).toBe(before);
});

test('repeated deletion preserves original tombstone backup and fence', async () => {
  const fence = await deleteAndFence();
  const tombstone = mockDb.rows.get(parent + '/deletedStock/sku');
  await store.deleteStockItem('a', 'sku', 'admin');
  expect(mockDb.rows.get(parent + '/deletedStock/sku')).toEqual(tombstone);
  expect(mockDb.rows.get(parent + '/items/sku').stockHistoryDeletedBefore).toBe(fence);
});

test('deletion follows active generation without changing retained root stock', async () => {
  const root = parent + '/generations/g1';
  mockDb.rows.get(parent).activeGeneration = 'g1';
  mockDb.rows.set(root + '/stock/sku', zero);
  await store.deleteStockItem('a', 'sku', 'admin');
  expect(mockDb.rows.has(root + '/stock/sku')).toBe(false);
  expect(mockDb.rows.get(root + '/deletedStock/sku').stockSnapshot).toEqual(zero);
  expect(mockDb.rows.get(root + '/items/sku').stockHistoryDeletedBefore).toEqual(expect.any(String));
  expect(mockDb.rows.get(parent + '/stock/sku')).toEqual(zero);
});

test('history suppresses old, missing and equal-cutoff movements while retaining newer exact-key history', async () => {
  const fence = await deleteAndFence();
  const samples = [
    ['old', { createdAt: '2020-01-01T00:00:00Z' }],
    ['missing', {}], ['equal', { createdAt: fence }],
    ['new', { createdAt: new Date(Date.parse(fence) + 1000).toISOString() }],
  ];
  for (const [id, fields] of samples) mockDb.rows.set(parent + '/movements/' + id, { itemKey: 'sku', itemCode: 'SKU', quantityBar: 1, movementType: 'inbound', ...fields });
  expect((await store.getItemMovementsHistory('a', 'sku', 'SKU')).map(row => row.id)).toEqual(['new']);
});

test('item-code fallback does not suppress another identity using the same code', async () => {
  await deleteAndFence();
  mockDb.rows.set(parent + '/movements/other', { itemKey: 'other', itemCode: 'SKU', createdAt: '2020-01-01T00:00:00Z', quantityBar: 1, movementType: 'inbound' });
  expect((await store.getItemMovementsHistory('a', 'sku', 'SKU')).map(row => row.id)).toEqual(['other']);
});

test('new inbound clears tombstone but preserves deletion fence; rollback old outbound cannot recreate stock', async () => {
  mockDb.rows.set(parent + '/invoices/old', { invoiceNumber: 'OLD', movementType: 'outbound' });
  mockDb.rows.set(parent + '/dispatches/coating', { currentStage: 'partially_delivered', items: [{ quantityBar: 10, deliveredQuantityBar: 3 }] });
  mockDb.rows.set(parent + '/movements/old', { dispatchAllocations: [{ dispatchId: 'coating', itemIndex: 0, bars: 3 }], invoiceId: 'old', invoiceNumber: 'OLD', itemKey: 'sku', movementType: 'outbound', quantityBar: 3, quantityLm: 18, createdAt: '2020-01-01T00:00:00Z' });
  const fence = await deleteAndFence();
  await store.rollbackInvoiceTransaction('a', 'old', 'admin');
  expect(mockDb.rows.has(parent + '/stock/sku')).toBe(false);
  expect(mockDb.rows.get(parent + '/dispatches/coating').items[0].deliveredQuantityBar).toBe(3);
  await store.processInboundInvoice('a', { invoiceNumber: 'NEW', movementType: 'inbound' }, [line(2)], 'admin');
  expect(mockDb.rows.has(parent + '/deletedStock/sku')).toBe(false);
  expect(mockDb.rows.get(parent + '/items/sku').stockHistoryDeletedBefore).toBe(fence);
  expect(mockDb.rows.get(parent + '/stock/sku').quantityBar).toBe(2);
});

test('rollback a post-fence invoice remains allowed', async () => {
  const fence = await deleteAndFence();
  mockDb.rows.get(parent + '/items/sku').stockHistoryDeletedBefore = new Date(Date.parse(fence) - 1000).toISOString();
  const incoming = await store.processInboundInvoice('a', { invoiceNumber: 'AFTER', movementType: 'inbound' }, [line(2)], 'admin');
  await store.rollbackInvoiceTransaction('a', incoming.invoiceId, 'admin');
  expect(mockDb.rows.get(parent + '/stock/sku').quantityBar).toBe(0);
});
