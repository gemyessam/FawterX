const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { parseSmartDocument } = require('./src/utils/smartParser');
const path = require('path');
const os = require('os');

// First extract raw text to see what the parser sees
async function testParser() {
  const pdfPath = 'C:/Users/GeMy/Documents/System and Electronic Invoice/System invoice 610.PDF';
  
  console.log('=== Testing Schüco Parser ===\n');
  
  try {
    const result = await parseSmartDocument(pdfPath, true);
    
    console.log('Parser Mode:', result.parserDebugInfo?.mode);
    console.log('Lines found:', result.invoiceLines?.length);
    console.log('Confidence:', result.confidenceScore);
    console.log('\n=== METADATA ===');
    console.log(JSON.stringify(result.metadata, null, 2));
    console.log('\n=== INVOICE LINES ===');
    result.invoiceLines?.forEach((line, i) => {
      console.log(`\n[Line ${i+1}] ${line.itemCode} - ${line.rawDescription}`);
      console.log(`  Description: ${line.description}`);
      console.log(`  Qty: ${line.quantity} ${line.unitType}`);
      console.log(`  Unit Price: ${line.unitValue} EGP`);
      console.log(`  Total: ${line.total} EGP`);
      if (line.warnings?.length) console.log(`  ⚠️ Warnings:`, line.warnings);
      if (line.missingFields?.length) console.log(`  ❌ Missing:`, line.missingFields);
    });
    
    if (result.warnings?.length) {
      console.log('\n=== PARSER WARNINGS ===');
      result.warnings.slice(0, 10).forEach(w => console.log(' -', w));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testParser();
