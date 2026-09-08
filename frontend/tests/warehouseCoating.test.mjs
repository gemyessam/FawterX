import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDelmarPool, findDelmarPoolMatches } from '../src/utils/warehouseCoating.mjs';

const dispatch = { id: 'd', currentStage: 'in_coating', isCompleted: false, items: [{ itemCode: '515756', lengthMm: 6000, quantityBar: 10, deliveredQuantityBar: 4 }] };
test('partial delivery displays only the remaining coating quantity', () => {
  const [item] = getDelmarPool([dispatch]);
  assert.equal(item.remainingBars, 6);
});
test('similar codes, different lengths and unrelated warehouses do not supply a line', () => {
  const pool = getDelmarPool([dispatch]);
  assert.deepEqual(findDelmarPoolMatches({ itemCode: '515750', lengthMm: 6000 }, pool), []);
  assert.deepEqual(findDelmarPoolMatches({ itemCode: '515756', lengthMm: 4000 }, pool), []);
  assert.deepEqual(findDelmarPoolMatches({ itemCode: 'OTHER' }, pool), []);
});
test('an explicit project alias permits the exact code and length', () => {
  const pool = getDelmarPool([dispatch]);
  const matches = findDelmarPoolMatches({ itemCode: '515750', lengthMm: 6000 }, pool, { alias: { aliasCode: '515750', targetItemCode: '515756' } });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].dispatchId, 'd');
});
test('cancelled, delivered and closed orders never appear as available stock', () => {
  assert.deepEqual(getDelmarPool([{ ...dispatch, isCancelled: true }, { ...dispatch, isCompleted: true }, { ...dispatch, currentStage: 'closed' }]), []);
});
