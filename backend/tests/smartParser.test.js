const { parseSchucoInvoice } = require('../src/utils/smartParser');

describe('parseSchucoInvoice - Hierarchical Document Understanding Tests', () => {
  test('should correctly parse Schüco Invoice 612 mock PDF text with mathematical deductions', () => {
    const mockSchucoText = `
    OMSI Egypt
    Receiver VAT: 650-535-960
    Schüco Egypt LLC
    708-820-883
    Invoice No: 000000612
    Date: 21.05.2026

    Pos. \t Item No. \t Description
    1 \t 9655090 \t UNIT FACADE FEMALE MULLION 170MM
    5 \t BAR \t 2,462.96 \t /1BAR \t 12,314.80
    3,950 \t 50.47 \t Length \t KG
    Finish \t RAL9007SD
    Egypt

    2 \t 9655090 \t UNIT FACADE FEMALE MULLION 170MM
    14.70 \t LM \t 623.53 \t /1M \t 9,165.96
    3,950 \t 50.47 \t Length \t KG
    Finish \t RAL9007SD
    Egypt

    3 \t 9655090 \t UNIT FACADE FEMALE MULLION 170MM
    11.80 \t LM \t 623.53 \t /1M \t 7,357.67
    3,950 \t 50.47 \t Length \t KG
    Finish \t RAL9007SD
    Egypt

    28,838.43 \t Net Amount
    4,037.38 \t VAT
    32,875.81 \t Total Amount

    Bank Details:
    Account: 1234567890
    IBAN: EG1234567890
    Swift: ABCDE
    `;

    const result = parseSchucoInvoice(mockSchucoText);
    expect(result).not.toBeNull();
    
    const { metadata, invoiceLines } = result;

    // Verify Metadata
    expect(metadata.internalID).toBe('000000612');
    expect(metadata.receiverVat).toBe('650535960');
    expect(metadata.issuerVat).toBe('708820883');
    expect(metadata.netAmount).toBe(28838.43);
    expect(metadata.taxAmount).toBe(4037.38);
    expect(metadata.totalAmount).toBe(32875.81);

    // Verify lines count
    expect(invoiceLines.length).toBe(3);

    // Line 1: Code = 9655090, Qty = 19.75, Price = 623.53, Net = 12314.80
    const l1 = invoiceLines[0];
    expect(l1.internalCode).toBe('9655090');
    expect(l1.quantity).toBe(19.75); // 5 BAR * 3.95m = 19.75 LM
    expect(Number((l1.quantity * l1.unitValue).toFixed(2))).toBe(12314.80);
    expect(Number(l1.unitValue.toFixed(2))).toBe(623.53);
    expect(l1.description).toBe('Aluminium | 9655090 | UNIT FACADE FEMALE MULLION 170MM | 50.47 KG | 3,950 mm | RAL9007SD');

    // Line 2: Code = 9655090, Qty = 14.70, Price = 623.53, Net = 9165.96
    const l2 = invoiceLines[1];
    expect(l2.internalCode).toBe('9655090');
    expect(l2.quantity).toBe(14.70);
    expect(Number((l2.quantity * l2.unitValue).toFixed(2))).toBe(9165.96);
    expect(Number(l2.unitValue.toFixed(2))).toBe(623.53);
    expect(l2.description).toBe('Aluminium | 9655090 | UNIT FACADE FEMALE MULLION 170MM | 50.47 KG | 3,950 mm | RAL9007SD');

    // Line 3: Code = 9655090, Qty = 11.80, Price = 623.53, Net = 7357.67
    const l3 = invoiceLines[2];
    expect(l3.internalCode).toBe('9655090');
    expect(l3.quantity).toBe(11.80);
    expect(Number((l3.quantity * l3.unitValue).toFixed(2))).toBe(7357.67);
    expect(Number(l3.unitValue.toFixed(2))).toBe(623.53);
    expect(l3.description).toBe('Aluminium | 9655090 | UNIT FACADE FEMALE MULLION 170MM | 50.47 KG | 3,950 mm | RAL9007SD');
  });

  test('should accurately classify standalone numbers when OCR output is fragmented and lacks labels', () => {
    const fragmentedOCRText = `
    1 9655090
    UNIT FACADE FEMALE MULLION 170MM
    5.00
    12314.80
    3950
    50.47
    170 mm
    
    12314.80 Net Amount
    `;

    const result = parseSchucoInvoice(fragmentedOCRText);
    expect(result).not.toBeNull();
    
    const { invoiceLines } = result;
    expect(invoiceLines.length).toBe(1);

    const l1 = invoiceLines[0];
    // Expected classifications based on heuristics:
    // 12314.80 -> lineNetAmount
    // 3950 -> length
    // 50.47 -> weight
    // 5.00 -> barQty
    // lmQty should be calculated as 5 * 3.95 = 19.75
    // unitValue should be calculated as 12314.80 / 19.75 = 623.53
    
    expect(l1.internalCode).toBe('9655090');
    expect(l1.quantity).toBe(19.75);
    expect(Number((l1.quantity * l1.unitValue).toFixed(2))).toBe(12314.80);
    expect(Number(l1.unitValue.toFixed(2))).toBe(623.53);
    
    // The description MUST NOT contain 5.00, 12314.80, 3950, 50.47, or 170 mm concatenated into the productName part.
    expect(l1.description).toBe('Aluminium | 9655090 | UNIT FACADE FEMALE MULLION 170MM | 50.47 KG | 3,950 mm');
  });

  test('should correctly segment blocks and extract exact literal text when Pos number is missing', () => {
    const textWithoutPos = `
    153000
    Vent profile 81/69
    6000 mm
    39.93 KG
    `;

    const result = parseSchucoInvoice(textWithoutPos);
    expect(result).not.toBeNull();
    
    const { invoiceLines } = result;
    expect(invoiceLines.length).toBe(1);

    const l1 = invoiceLines[0];
    
    // Exact text extraction without hallucinations
    expect(l1.internalCode).toBe('153000');
    expect(l1.description).toBe('Aluminium | 153000 | Vent profile 81/69 | 39.93 KG | 6,000 mm');
  });
});
