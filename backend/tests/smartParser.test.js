const { parseSchucoInvoice } = require('../src/utils/smartParser');

describe('parseSchucoInvoice - Hierarchical Document Understanding Tests', () => {
  test('should produce exactly 1 invoice line per block (BAR/KG/LM are same item)', () => {
    // This mock has 3 blocks (Pos 1, 2, 3) each with BAR + LM rows.
    // BAR/KG/LM are 3 representations of the SAME item, NOT separate items.
    const mockSchucoText = `
    OMSI Egypt
    Receiver VAT: 650-535-960
    Schüco Egypt LLC
    708-820-883
    Invoice No: 000000612
    Date: 21.05.2026

    Pos. \\t Item No. \\t Description
    1 \\t 9655090 \\t UNIT FACADE FEMALE MULLION 170MM
    5 \\t BAR \\t 2,462.96 \\t /1BAR \\t 12,314.80
    3,950 \\t 50.47 \\t Length \\t KG
    19.75 \\t LM \\t 623.53 \\t /1M \\t 12,314.80
    Finish \\t RAL9007SD
    Egypt

    2 \\t 9655090 \\t UNIT FACADE FEMALE MULLION 170MM
    3 \\t BAR \\t 3,055.30 \\t /1BAR \\t 9,165.89
    4,900 \\t 37.57 \\t Length \\t KG
    14.70 \\t LM \\t 623.53 \\t /1M \\t 9,165.89
    Finish \\t RAL9007SD
    Egypt

    3 \\t 9655090 \\t UNIT FACADE FEMALE MULLION 170MM
    4 \\t BAR \\t 1,839.42 \\t /1BAR \\t 7,357.67
    2,950 \\t 30.15 \\t Length \\t KG
    11.80 \\t LM \\t 623.53 \\t /1M \\t 7,357.67
    Finish \\t RAL9007SD
    Egypt

    28,838.36 \\t Net Amount
    4,037.37 \\t VAT
    32,875.73 \\t Total Amount

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

    // CRITICAL: Exactly 3 lines (1 per block), NOT 6 or 8
    expect(invoiceLines.length).toBe(3);

    // Line 1: LM qty=19.75, unit price from /1M=623.53, net=12,314.80
    const l1 = invoiceLines[0];
    expect(l1.internalCode).toBe('9655090');
    expect(l1.itemCode).toBe('EG-708820883-1');
    expect(l1.codeName).toBe('Aluminium');
    expect(l1.quantity).toBe(19.75);
    expect(l1.unitType).toBe('M');
    expect(Number(l1.unitValue.toFixed(2))).toBe(623.53);
    expect(l1.net).toBe(12314.80);
    // Rich description matching template
    expect(l1.description).toBe('Aluminium | 9655090 | UNIT FACADE FEMALE MULLION 170MM | 5 Bar / 19.75 LM | 50.47 KG | 3,950 mm | RAL9007SD');

    // Line 2: LM qty=14.70, net=9,165.89
    const l2 = invoiceLines[1];
    expect(l2.quantity).toBe(14.70);
    expect(Number(l2.unitValue.toFixed(2))).toBe(623.53);
    expect(l2.net).toBe(9165.89);

    // Line 3: LM qty=11.80, net=7,357.67
    const l3 = invoiceLines[2];
    expect(l3.quantity).toBe(11.80);
    expect(Number(l3.unitValue.toFixed(2))).toBe(623.53);
    expect(l3.net).toBe(7357.67);
  });

  test('should derive LM from BAR qty * length when LM line is missing', () => {
    const fragmentedOCRText = `
    1 9655090
    UNIT FACADE FEMALE MULLION 170MM
    5 \\t BAR \\t 2,462.96 \\t /1BAR \\t 12,314.80
    3,950 \\t 50.47 \\t Length \\t KG
    Finish \\t RAL9007SD
    Egypt
    
    12314.80 Net Amount

    Bank Details:
    Account: 123
    `;

    const result = parseSchucoInvoice(fragmentedOCRText);
    expect(result).not.toBeNull();
    
    const { invoiceLines } = result;
    // Only 1 block = only 1 line
    expect(invoiceLines.length).toBe(1);

    const l1 = invoiceLines[0];
    expect(l1.internalCode).toBe('9655090');
    // LM derived: 5 BAR * 3.95m = 19.75 LM
    expect(l1.quantity).toBe(19.75);
    expect(l1.unitType).toBe('M');
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
    expect(l1.description).toContain('Vent profile 81/69');
    expect(l1.description).toContain('39.93 KG');
    expect(l1.description).toContain('6,000 mm');
  });
});
