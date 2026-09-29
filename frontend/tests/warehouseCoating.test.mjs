import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDelmarPool, findDelmarPoolMatches } from '../src/utils/warehouseCoating.mjs';

const dispatch = { id: 'd', currentStage: 'in_coating', isCompleted: false, items: [{ itemCode: '515756', lengthMm: 6000, quantityBar: 10, deliveredQuantityBar: 4 }] };
test('partial delivery displays only the remaining coating quantity', () => {
  const [item] = getDelmarPool([dispatch]);
  assert.equal(item.remainingBars, 6);
});
test('unrelated codes and different lengths do not supply a line, while default 515750 <=> 515756 alias matches automatically', () => {
  const pool = getDelmarPool([dispatch]);
  // Default cross-reference alias 515750 <=> 515756 matches automatically
  const autoMatches = findDelmarPoolMatches({ itemCode: '515750', lengthMm: 6000 }, pool);
  assert.equal(autoMatches.length, 1);
  assert.equal(autoMatches[0].dispatchId, 'd');

  // Unrelated codes or wrong lengths do not match
  assert.deepEqual(findDelmarPoolMatches({ itemCode: '515751', lengthMm: 6000 }, pool), []);
  assert.deepEqual(findDelmarPoolMatches({ itemCode: '515756', lengthMm: 4000 }, pool), []);
  assert.deepEqual(findDelmarPoolMatches({ itemCode: 'OTHER' }, pool), []);
});
test('an explicit project alias permits the exact code and length', () => {
  const pool = getDelmarPool([dispatch]);
  const matches = findDelmarPoolMatches({ itemCode: '515750', lengthMm: 6000 }, pool, { alias: { aliasCode: '515750', targetItemCode: '515756' } });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].dispatchId, 'd');

  // Reverse direction alias check
  const reverseMatches = findDelmarPoolMatches({ itemCode: '515750', lengthMm: 6000 }, pool, { alias: { aliasCode: '515756', targetItemCode: '515750' } });
  assert.equal(reverseMatches.length, 1);
  assert.equal(reverseMatches[0].dispatchId, 'd');
});
test('partially_delivered stage and scrapQuantityBar reduce available coating pool bars', () => {
  const partialWithScrap = {
    id: 'd_scrap',
    currentStage: 'partially_delivered',
    isCompleted: false,
    items: [{
      itemCode: '515756',
      lengthMm: 6000,
      quantityBar: 10,
      deliveredQuantityBar: 4,
      scrapQuantityBar: 2,
    }],
  };
  const [item] = getDelmarPool([partialWithScrap]);
  assert.equal(item.remainingBars, 4); // 10 - 4 - 2 = 4
});

test('dispatch where delivered + scrap >= total does not appear in active pool', () => {
  const settled = {
    id: 'd_settled',
    currentStage: 'partially_delivered',
    isCompleted: false,
    items: [{
      itemCode: '515756',
      lengthMm: 6000,
      quantityBar: 10,
      deliveredQuantityBar: 8,
      scrapQuantityBar: 2,
    }],
  };
  assert.deepEqual(getDelmarPool([settled]), []);
});

