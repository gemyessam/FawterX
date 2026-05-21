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

test('mapToETADocument EGS itemCode raw preservation', () => {
  const rows = [
    {
      description: 'Test Item',
      itemCode: '708820883-1',
      codeType: 'EGS',
      internalCode: '153000',
      quantity: 1,
      unitValue: 100,
    }
  ];
  const customMapping = {
    ...mapping,
    codeType: 'codeType',
    internalCode: 'internalCode'
  };
  const docs = mapToETADocument(customMapping, rows, issuer);
  const line = docs[0].invoiceLines[0];
  expect(line.itemType).toBe('EGS');
  expect(line.itemCode).toBe('EG-708820883-1');
  expect(line.name).toBe('Test Item');
  expect(line.internalCode).toBe('153000');
});

test('mapToETADocument meter unit mappings map to M', () => {
  const rows = [
    {
      description: 'Test Item 1',
      unitType: 'm',
      quantity: 1,
      unitValue: 100,
    },
    {
      description: 'Test Item 2',
      unitType: 'meter',
      quantity: 1,
      unitValue: 100,
    }
  ];
  const docs = mapToETADocument(mapping, rows, issuer);
  expect(docs[0].invoiceLines[0].unitType).toBe('M');
  expect(docs[0].invoiceLines[1].unitType).toBe('M');
});
