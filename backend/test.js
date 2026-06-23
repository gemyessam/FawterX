const text = \
Net Amount          EUR         27,440.35
Packing             EUR          2,692.60
Freight             EUR          3,189.93
VAT                 EUR              0.00
Total Amount        EUR         33,322.88
\;
const rawLines = text.split('\n');
let packingAmt = 0;
let freightAmt = 0;
let metadata = {currency: 'EGP'};
for (const line of rawLines) {
    const currMatch = line.match(/(?:Net Amount|Total Amount|Packing|Freight|VAT)\s+([A-Z]{3})\s+[\d,.]+/i);
    if (currMatch) metadata.currency = currMatch[1].toUpperCase();
    const packMatch = line.match(/Packing\s+(?:[A-Z]{3}\s+)?([\d,.]+(?:\.\d+)?)/i);
    if (packMatch) packingAmt = parseFloat(packMatch[1].replace(/,/g, ''));
    const freightMatch = line.match(/Freight\s+(?:[A-Z]{3}\s+)?([\d,.]+(?:\.\d+)?)/i);
    if (freightMatch) freightAmt = parseFloat(freightMatch[1].replace(/,/g, ''));
}
console.log({metadata, packingAmt, freightAmt});

