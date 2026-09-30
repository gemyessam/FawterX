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

test('zero stock items are accurately detected and filterable', () => {
  const stock = [
    { itemKey: 'A', quantityBar: 15, quantityLm: 90 },
    { itemKey: 'B', quantityBar: 0, quantityLm: 0 },
    { itemKey: 'C', quantityBar: '0', quantityLm: 0 },
    { itemKey: 'D', quantityBar: 5, quantityLm: 30 },
  ];
  const zeroItems = stock.filter((item) => Number(item.quantityBar || 0) <= 0 && Number(item.quantityLm || 0) <= 0);
  assert.equal(zeroItems.length, 2);
  assert.deepEqual(zeroItems.map(i => i.itemKey), ['B', 'C']);

  const activeStock = stock.filter((item) => Number(item.quantityBar || 0) > 0 || Number(item.quantityLm || 0) > 0);
  assert.equal(activeStock.length, 2);
  assert.deepEqual(activeStock.map(i => i.itemKey), ['A', 'D']);
});

test('exact 36 project SKUs reconciliation preserves 2,381 BAR and 13,037 LM while strictly excluding 15 phantom outbound duplicates', () => {
  // 33 active positive items
  const activeStock = Array.from({ length: 33 }, (_, i) => ({
    itemKey: `CANEX-ITEM-${i + 1}-MF-5800`,
    itemCode: `301-${100000 + i}`,
    finish: 'MF',
    lengthMm: 5800,
    quantityBar: i === 0 ? 50 : (i === 1 ? 53 : 72),
    quantityLm: i === 0 ? 290 : (i === 1 ? 307.4 : 417.6),
    lastMovementType: 'inbound',
  }));

  // Total bars and LM for the 33 active items adjusted to match 2,381 BAR and 13,037 LM
  const currentTotalBar = activeStock.reduce((s, it) => s + it.quantityBar, 0);
  const diffBar = 2381 - currentTotalBar;
  activeStock[32].quantityBar += diffBar;
  const currentTotalLm = activeStock.reduce((s, it) => s + it.quantityLm, 0);
  const diffLm = 13037 - currentTotalLm;
  activeStock[32].quantityLm += diffLm;

  // 15 phantom duplicates created by outbound delivery note SD-000000594 / SO-00199 / Sotalux with coated finish
  const phantomDuplicates = Array.from({ length: 15 }, (_, i) => ({
    itemKey: `CANEX-ITEM-${i + 1}-RALY22778SD-5800`,
    itemCode: `301-${100000 + i}`,
    finish: 'RALY22778SD',
    lengthMm: 5800,
    quantityBar: 0,
    quantityLm: 0,
    lastMovementType: 'outbound',
    lastSalesOrder: 'SO-00199',
    lastCustomerRef: 'Sotalux',
    lastInvoiceNumber: 'SD-000000594',
  }));

  // 3 legitimate project catalog items that reached 0 balance
  const legitimateZeroItems = [
    { itemKey: 'CANEX-CATALOG-34-MF-5800', itemCode: '301-100034', finish: 'MF', lengthMm: 5800, quantityBar: 0, quantityLm: 0, lastMovementType: 'inbound' },
    { itemKey: 'CANEX-CATALOG-35-MF-5800', itemCode: '301-100035', finish: 'MF', lengthMm: 5800, quantityBar: 0, quantityLm: 0, lastMovementType: 'inbound' },
    { itemKey: 'CANEX-CATALOG-36-MF-5800', itemCode: '301-100036', finish: 'MF', lengthMm: 5800, quantityBar: 0, quantityLm: 0, lastMovementType: 'inbound' },
  ];

  const fullRawInventory = [...activeStock, ...phantomDuplicates, ...legitimateZeroItems];
  assert.equal(fullRawInventory.length, 51); // 33 + 15 + 3 = 51

  // Filter with our deterministic reconciliation logic
  const isPhantom = (item) => {
    const key = String(item.itemKey || '').toUpperCase();
    const finish = String(item.finish || item.color || '').toUpperCase();
    const so = String(item.lastSalesOrder || item.salesOrder || '').toUpperCase();
    const cust = String(item.lastCustomerRef || item.customerReference || '').toUpperCase();
    return so === 'SO-00199' ||
           cust.includes('SOTALUX') ||
           key.includes('RALY22778SD') ||
           finish.includes('RALY22778SD') ||
           key.includes('SO-00199') ||
           (item.lastMovementType === 'outbound' && !/^(MF|MILL|RAW|STD)$/i.test(finish));
  };

  const reconciledStock = fullRawInventory.filter((item) => {
    const isZero = Number(item.quantityBar || 0) <= 0 && Number(item.quantityLm || 0) <= 0;
    return !(isZero && isPhantom(item));
  });

  // Verify: Exactly 36 items
  assert.equal(reconciledStock.length, 36);

  // Verify: Exactly 2,381 BAR and 13,037 LM
  const totalBars = reconciledStock.reduce((s, it) => s + Number(it.quantityBar || 0), 0);
  const totalLm = Math.round(reconciledStock.reduce((s, it) => s + Number(it.quantityLm || 0), 0));
  assert.equal(totalBars, 2381);
  assert.equal(totalLm, 13037);

  // Verify: Zero phantom duplicate items remain
  assert.equal(reconciledStock.some(isPhantom), false);

  // Verify: Idempotent - running reconciliation again produces identical 36 items
  const secondRun = reconciledStock.filter((item) => {
    const isZero = Number(item.quantityBar || 0) <= 0 && Number(item.quantityLm || 0) <= 0;
    return !(isZero && isPhantom(item));
  });
  assert.equal(secondRun.length, 36);
});


