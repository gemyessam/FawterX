const { parseSchucoInvoice } = require('./src/utils/smartParser');

const text = `
Pos. Item No. Error Quantity Unit Price/ Unit Net Price Total Net
1 539070 2T Outer Frame Bottom 149.00 BAR 2,232.03 /1BAR
1,032.83 KG 322.00 /1KG 332,571.98
819.50 LM 405.82 /1M
Total amount 332,571.98
Length 5,500 mm
Country of origin Egypt
2 539070 2T Outer Frame Bottom 165.00 BAR 2,637.85 /1BAR
1,351.69 KG 322.00 /1KG 435,245.21
1,072.50 LM 405.82 /1M
Total amount 435,245.21
Length 6,500 mm
Country of origin Egypt
Net Amount EGP 1,779,341.72
VAT EGP 249,107.84
Total Amount EGP 2,028,449.56
`;

(async () => {
  const result = await parseSchucoInvoice(text);
  console.log(JSON.stringify(result, null, 2));
})();
