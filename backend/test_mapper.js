const { mapToETADocument } = require('./src/utils/etaMapper');

const rows = [
  {
    quantity: 819.5,
    unitValue: 405.823,
    netTotal: 332571.98,
    currency: 'EGP',
    taxPercent: 14,
    description: "Item 1"
  },
  {
    quantity: 1072.5,
    unitValue: 405.823,
    netTotal: 435245.21,
    currency: 'EGP',
    taxPercent: 14,
    description: "Item 2"
  },
  {
    quantity: 1237.5,
    unitValue: 442.067,
    netTotal: 547058.36,
    currency: 'EGP',
    taxPercent: 14,
    description: "Item 3"
  },
  {
    quantity: 2106,
    unitValue: 220.544,
    netTotal: 464466.17,
    currency: 'EGP',
    taxPercent: 14,
    description: "Item 4"
  }
];

const mapping = {
  quantity: 'quantity',
  unitValue: 'unitValue',
  description: 'description',
};

const result = mapToETADocument({ mapping, rows, issuer: {}, metadata: { receiverType: 'B' } });
console.log(JSON.stringify(result, null, 2));
