const { mapToETADocument } = require('../src/utils/etaMapper');

// عينة بيانات إكسل
const sampleRows = [
  {
    description: 'خدمة استشارة',
    itemCode: 'EG-001',
    unitType: 'EA',
    quantity: 2,
    unitValue: 150,
    taxPercent: 14,
  },
];

const mapping = {
  description: 'description',
  itemCode: 'itemCode',
  unitType: 'unitType',
  quantity: 'quantity',
  unitValue: 'unitValue',
  taxPercent: 'taxPercent',
};

const issuer = {
  taxNumber: '1234567890',
  name: 'شركة مثال',
  address: 'القاهرة, مصر',
  // ... باقي الحقول الثابتة
};

test('mapToETADocument يتحول بشكل صحيح', () => {
  const docs = mapToETADocument(mapping, sampleRows, issuer);
  expect(Array.isArray(docs)).toBe(true);
  expect(docs.length).toBe(1);
  const doc = docs[0];
  expect(doc).toHaveProperty('invoiceLines');
  expect(doc.invoiceLines.length).toBe(1);
  const line = doc.invoiceLines[0];
  expect(line.description).toBe('خدمة استشارة');
  expect(line.unitValue.currencySold).toBe('EGP');
});
