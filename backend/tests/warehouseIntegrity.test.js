const { createFirestore } = require('./helpers/warehouseFirestore');
let mockDb;
const mockFirestore = Object.assign(() => mockDb, { FieldValue: {
  increment: value => ({ __operation: 'increment', value }),
  arrayUnion: (...value) => ({ __operation: 'arrayUnion', value }),
  arrayRemove: (...value) => ({ __operation: 'arrayRemove', value }),
}});
jest.mock('../src/services/firebaseAdmin', () => ({ apps: [{}], firestore: mockFirestore }));
const store = require('../src/services/warehouseStore');
const { COLLECTIONS } = require('../src/services/warehousePersistence');
const parent = 'warehouseProjects/a';
beforeEach(() => { mockDb = createFirestore({ [parent]: { name: 'A', code: 'CANEX', status: 'active' }, 'warehouseProjects/b': { name: 'B', code: 'CANEX', status: 'active' } }); });

test('exact IDs survive same-code listing and archive; all data can be unarchived', async () => {
  mockDb.rows.get(parent).id = 'forged';
  mockDb.rows.set(parent + '/stock/item', { quantityBar: 7 });
  expect((await store.listProjects()).map(p => p.id)).toEqual(['a', 'b']);
  await store.deleteProject('a', 'admin');
  expect((await store.listProjects()).map(p => p.id)).toEqual(['b']);
  expect(mockDb.rows.get(parent + '/stock/item').quantityBar).toBe(7);
  await store.unarchiveProject('a', 'admin');
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(7);
});
test('legacy ID is never redirected to another CANEX project', async () => {
  expect(await store.resolveProject('default_canex')).toBe('default_canex');
  await expect(store.deleteProject('default_canex', 'admin')).rejects.toMatchObject({ statusCode: 404 });
  expect((await store.listProjects()).length).toBe(2);
});
test('concurrent archive cannot remove last active warehouse', async () => {
  const results = await Promise.allSettled([store.deleteProject('a', 'admin'), store.deleteProject('b', 'admin')]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await store.listProjects()).toHaveLength(1);
});
test('concurrent normalized-code creation yields one project; listing never creates ghosts', async () => {
  mockDb = createFirestore();
  expect(await store.listProjects()).toEqual([]);
  const results = await Promise.allSettled([store.createProject({ name: 'One', code: ' same code ' }, 'admin'), store.createProject({ name: 'Two', code: 'SAME_CODE' }, 'admin')]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await store.listProjects()).toHaveLength(1);
});
test('complete snapshot round-trips every warehouse collection and exact empty collections', async () => {
  for (const col of COLLECTIONS) mockDb.rows.set(parent + '/' + col + '/original', { col, value: 2, isDeleted: true });
  mockDb.rows.delete(parent + '/dispatches/original');
  const point = await store.createProjectRestorePoint('a', { name: 'Complete' }, 'admin');
  for (const col of COLLECTIONS) mockDb.rows.set(parent + '/' + col + '/later', { value: 999 });
  await store.restoreProjectToPoint('a', point.id, 'admin');
  const root = parent + '/generations/' + mockDb.rows.get(parent).activeGeneration;
  for (const col of COLLECTIONS.filter(c => c !== 'dispatches')) expect(mockDb.rows.get(root + '/' + col + '/original')).toEqual({ col, value: 2, isDeleted: true });
  expect((await store.getProjectDispatches('a'))).toEqual([]);
  expect([...mockDb.rows.keys()].filter(k => k.startsWith(root) && k.endsWith('/later'))).toEqual([]);
  expect(mockDb.rows.get('warehouseProjects/b').activeGeneration).toBeUndefined();
  expect(mockDb.rows.has(parent + '/stock/later')).toBe(true); // previous generation retained
  const next = await store.createProjectRestorePoint('a', { name: 'After restore' }, 'admin');
  expect(next.collectionCounts.dispatches).toBe(0);
  expect(next.collectionCounts.stock).toBe(1);
});
test('snapshot read failure creates no incomplete restore point', async () => {
  mockDb.failRead = parent + '/itemAliases';
  await expect(store.createProjectRestorePoint('a', {}, 'admin')).rejects.toThrow('injected');
  expect([...mockDb.rows.keys()].some(key => key.includes('/restorePoints/'))).toBe(false);
});
test('staging failure and corrupted snapshot leave active data untouched', async () => {
  mockDb.rows.set(parent + '/stock/original', { quantityBar: 8 });
  const point = await store.createProjectRestorePoint('a', {}, 'admin');
  mockDb.failCommit = true;
  await expect(store.restoreProjectToPoint('a', point.id, 'admin')).rejects.toThrow('injected');
  expect(mockDb.rows.get(parent).activeGeneration).toBeUndefined();
  mockDb.failCommit = false;
  mockDb.rows.get(parent + '/restorePoints/' + point.id).checksum = 'corrupt';
  await expect(store.restoreProjectToPoint('a', point.id, 'admin')).rejects.toThrow('checksum');
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(8);
});
test('legacy snapshot cannot silently wipe or partially restore current state', async () => {
  mockDb.rows.set(parent + '/restorePoints/old', { stockSnapshot: [] });
  await expect(store.restoreProjectToPoint('a', 'old', 'admin')).rejects.toMatchObject({ statusCode: 400 });
  expect(mockDb.rows.get(parent).activeGeneration).toBeUndefined();
});
test('stock and dispatch GET never repair, fabricate, or write data', async () => {
  mockDb.rows.set(parent + '/movements/m', { itemKey: 'missing', quantityBar: 10, isCancelled: true });
  mockDb.rows.set(parent + '/dispatches/d', { currentStage: 'closed', isCompleted: true });
  const before = JSON.stringify([...mockDb.rows]);
  expect(await store.getProjectStock('a')).toEqual([]);
  expect((await store.getProjectDispatches('a'))[0].currentStage).toBe('closed');
  expect(JSON.stringify([...mockDb.rows])).toBe(before);
});

const line = (quantityBar = 10) => ({ itemKey: 'sku', itemCode: 'SKU', description: 'Test item', finish: 'MF', lengthMm: 6000, quantityBar, quantityLm: quantityBar * 6, unitPrice: 2, barPrice: 12, netTotal: quantityBar * 12 });
test('inbound, duplicate retry, manual dispatch, rollback and restore remain linked', async () => {
  const incoming = await store.processInboundInvoice('a', { invoiceNumber: 'INV-real', movementType: 'inbound' }, [line()], 'admin');
  const retry = await store.processInboundInvoice('a', { invoiceNumber: 'INV-real', movementType: 'inbound', forceSave: true }, [line()], 'admin');
  expect(retry.isDuplicate).toBe(true);
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(10);
  const before = await store.createProjectRestorePoint('a', { name: 'Before dispatch' }, 'admin');
  await store.processManualStockMovement('a', { movementType: 'outbound', lines: [line(3)], meta: { docNumber: 'OUT-1' }, dispatchDetails: { dispatchType: 'coating_only' } }, 'admin');
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(7);
  const outgoing = (await store.getProjectInvoices('a')).find(inv => inv.invoiceNumber === 'OUT-1');
  expect(outgoing.dispatchId).toBeTruthy();
  expect((await store.getProjectMovements('a', outgoing.id))[0].dispatchId).toBe(outgoing.dispatchId);
  await store.rollbackInvoiceTransaction('a', outgoing.id, 'admin');
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(10);
  await expect(store.rollbackInvoiceTransaction('a', outgoing.id, 'admin')).rejects.toThrow();
  await store.restoreProjectToPoint('a', before.id, 'admin');
  expect(await store.getProjectDispatches('a')).toHaveLength(0);
  expect((await store.getProjectInvoices('a')).map(inv => inv.id)).toEqual([incoming.invoiceId]);
  await store.processManualStockMovement('a', { movementType: 'inbound', lines: [line(2)], meta: { docNumber: 'NEW' } }, 'admin');
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(12);
});
test('failed invoice commit leaves no invoice, movements, stock or incomplete automatic backup', async () => {
  mockDb.failCommit = true;
  await expect(store.processInboundInvoice('a', { invoiceNumber: 'NEW' }, [line()], 'admin')).rejects.toThrow('injected');
  expect([...mockDb.rows.keys()].filter(key => key.startsWith(parent + '/'))).toEqual([]);
});
test('negative, nonfinite, invalid movement type and overselling cannot mutate data', async () => {
  for (const qty of [-1, Infinity, NaN]) await expect(store.processInboundInvoice('a', {}, [line(qty)], 'admin')).rejects.toThrow();
  await expect(store.processManualStockMovement('a', { movementType: 'typo', lines: [line()] }, 'admin')).rejects.toThrow();
  await store.processInboundInvoice('a', { invoiceNumber: 'IN' }, [line(5)], 'admin');
  const before = JSON.stringify([...mockDb.rows]);
  await expect(store.processManualStockMovement('a', { movementType: 'outbound', lines: [line(3), line(3)], meta: { docNumber: 'TOO-MUCH' } }, 'admin')).rejects.toThrow('رصيد');
  expect(JSON.stringify([...mockDb.rows])).toBe(before);
});
test('manual retries and concurrent stock deductions are serialized', async () => {
  await store.processInboundInvoice('a', { invoiceNumber: 'IN' }, [line(5)], 'admin');
  const payload = { movementType: 'outbound', lines: [line(4)], meta: { docNumber: 'OUT' } };
  const outcomes = await Promise.all([store.processManualStockMovement('a', payload, 'admin'), store.processManualStockMovement('a', payload, 'admin')]);
  expect(outcomes.filter(r => r.isDuplicate)).toHaveLength(1);
  expect((await store.getProjectStock('a'))[0].quantityBar).toBe(1);
});
test('coating partial delivery closes only exact linked quantities and rollback reopens them', async () => {
  mockDb.rows.set(parent + '/dispatches/coating', { isCompleted: false, currentStage: 'in_coating', items: [line(10)] });
  mockDb.rows.set(parent + '/dispatches/unrelated', { isCompleted: false, currentStage: 'in_coating', items: [{ ...line(10), itemCode: 'OTHER', itemKey: 'other' }] });
  const input = { ...line(4), delmarCovered: true, delmarMode: 'full' };
  const invoice = await store.processInboundInvoice('a', { invoiceNumber: 'DELIVERY', movementType: 'outbound' }, [input], 'admin');
  expect(mockDb.rows.get(parent + '/dispatches/coating').items[0].deliveredQuantityBar).toBe(4);
  expect(mockDb.rows.get(parent + '/dispatches/coating').isCompleted).toBe(false);
  expect(mockDb.rows.get(parent + '/dispatches/unrelated').items[0].deliveredQuantityBar).toBeUndefined();
  await store.rollbackInvoiceTransaction('a', invoice.invoiceId, 'admin');
  expect(mockDb.rows.get(parent + '/dispatches/coating').items[0].deliveredQuantityBar).toBe(0);
  await expect(store.processInboundInvoice('a', { invoiceNumber: 'EXCESS', movementType: 'outbound' }, [{ ...line(11), delmarCovered: true, delmarMode: 'full' }], 'admin')).rejects.toThrow('الكمية');
});
test('more than 500 snapshot records restore through staged batches, including incompressible data', async () => {
  const { randomBytes } = require('node:crypto');
  for (let i = 0; i < 600; i++) mockDb.rows.set(parent + '/movements/m' + i, { invoiceId: 'i', data: randomBytes(2200).toString('base64') });
  const point = await store.createProjectRestorePoint('a', {}, 'admin');
  expect(point.chunks).toBeGreaterThan(1);
  await store.restoreProjectToPoint('a', point.id, 'admin');
  expect(await store.getProjectMovements('a')).toHaveLength(600);
  const summary = (await store.listProjectRestorePoints('a'))[0];
  expect(summary.movementsSnapshot).toBeUndefined();
  expect(summary.restorable).toBe(true);
});
test('concurrent warehouse changes reject the final restore switch', async () => {
  mockDb.rows.set(parent + '/stock/original', { quantityBar: 1 });
  const point = await store.createProjectRestorePoint('a', {}, 'admin');
  const originalBatch = mockDb.batch;
  let injected = false;
  mockDb.batch = () => {
    const batch = originalBatch(); const commit = batch.commit;
    batch.commit = async () => {
      await commit();
      if (!injected) { injected = true; await mockDb.doc(parent).update({ warehouseRevision: 99 }); }
    }; return batch;
  };
  await expect(store.restoreProjectToPoint('a', point.id, 'admin')).rejects.toMatchObject({ statusCode: 409 });
  expect(mockDb.rows.get(parent).activeGeneration).toBeUndefined();
});
test('alias changes move the stock link and survive restore without creating phantom stock', async () => {
  mockDb.rows.set(parent + '/stock/sku', line());
  mockDb.rows.set(parent + '/stock/second', { ...line(), itemCode: 'SECOND' });
  await store.saveProjectItemAlias('a', { aliasCode: 'External', targetItemKey: 'sku', userUid: 'admin' });
  const point = await store.createProjectRestorePoint('a', {}, 'admin');
  await store.saveProjectItemAlias('a', { aliasCode: 'External', targetItemKey: 'second', userUid: 'admin' });
  expect(mockDb.rows.get(parent + '/stock/sku').aliases).toEqual([]);
  expect((await store.getProjectItemAliases('a'))[0].targetItemKey).toBe('second');
  await expect(store.saveProjectItemAlias('a', { aliasCode: 'Missing', targetItemKey: 'absent', userUid: 'admin' })).rejects.toThrow();
  await store.restoreProjectToPoint('a', point.id, 'admin');
  expect((await store.getProjectItemAliases('a'))[0].targetItemKey).toBe('sku');
  expect((await store.getProjectStock('a')).find(item => item.itemKey === 'sku').aliases).toEqual(['External']);
});
test('stock adjustments are recorded in movements and copied to the item master', async () => {
  await store.processInboundInvoice('a', { invoiceNumber: 'IN' }, [line()], 'admin');
  await store.updateStockItem('a', 'sku', { quantityBar: 12, description: 'Adjusted' }, 'admin');
  expect(mockDb.rows.get(parent + '/items/sku').description).toBe('Adjusted');
  const adjustments = (await store.getProjectMovements('a')).filter(m => m.sourceType === 'stock_adjustment');
  expect(adjustments).toHaveLength(1);
  expect(adjustments[0].quantityBar).toBe(2);
  await expect(store.updateStockItem('a', 'sku', { itemCode: 'OTHER' }, 'admin')).rejects.toThrow();
});
test('explicit empty project permissions stay empty and blocked accounts cannot enter', async () => {
  mockDb.rows.set('users/operator', { email: 'operator@example.test', displayName: 'Operator', warehouseEnabled: true, warehouseRole: 'warehouse_operator', allowedProjects: ['a'] });
  await store.updateWarehouseUserAccess('operator', { warehouseEnabled: true, warehouseRole: 'warehouse_operator', allowedProjects: [] }, 'admin@example.test');
  expect((await store.getUserWarehouseAccess('operator', 'operator@example.test')).allowedProjects).toEqual([]);
  await mockDb.doc('users/operator').update({ access: { status: 'blocked' } });
  expect((await store.getUserWarehouseAccess('operator', 'operator@example.test')).enabled).toBe(false);
});
test('Firestore snapshot codec preserves types without key collisions', () => {
  const { encode, decode } = require('../src/services/warehouseSnapshots');
  const { Timestamp, GeoPoint } = require('@google-cloud/firestore');
  const data = { timestamp: new Timestamp(123, 456), geo: new GeoPoint(30, 31), date: new Date('2020-01-01'), bytes: Buffer.from('test'), nested: { scalar: ['map', null] }, number: NaN };
  const restored = decode(JSON.parse(JSON.stringify(encode(data))), mockDb, { firestore: { Timestamp, GeoPoint } });
  expect(restored.timestamp.isEqual(data.timestamp)).toBe(true);
  expect(restored.geo.isEqual(data.geo)).toBe(true);
  expect(restored.date).toEqual(data.date);
  expect(restored.bytes).toEqual(data.bytes);
  expect(restored.nested).toEqual(data.nested);
  expect(Number.isNaN(restored.number)).toBe(true);
});
