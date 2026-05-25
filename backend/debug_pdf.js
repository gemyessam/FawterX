/**
 * Quick local test: parse a real Schüco PDF and dump raw text + parsed result
 * Usage: node debug_pdf.js <path-to-pdf>
 */
const path = require('path');
const fs = require('fs');

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node debug_pdf.js <path-to-pdf>');
    process.exit(1);
  }

  const resolved = path.resolve(pdfPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  // 1. Read PDF with pdf-parse
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(resolved);
  const pdfData = await pdfParse(dataBuffer);
  const rawText = pdfData.text || '';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          RAW PDF TEXT (exactly as pdf-parse reads it)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(rawText);
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          RAW LINES (numbered)                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  const lines = rawText.split('\n');
  lines.forEach((line, i) => {
    console.log(`[${String(i).padStart(3,'0')}] "${line}"`);
  });

  // 2. Run our Schüco parser on it
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          SCHÜCO PARSER RESULT                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  const { parseSchucoInvoice } = require('./src/utils/smartParser');
  const result = parseSchucoInvoice(rawText);

  if (!result) {
    console.log('❌ parseSchucoInvoice returned NULL (not recognized as Schüco invoice)');
  } else {
    console.log(`✅ Found ${result.invoiceLines.length} invoice line(s)`);
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    result.invoiceLines.forEach((line, i) => {
      console.log(`\n--- Line ${i+1} ---`);
      console.log('  Description:', line.description);
      console.log('  Item Code:', line.itemCode);
      console.log('  Internal Code:', line.internalCode);
      console.log('  Quantity:', line.quantity);
      console.log('  Unit Type:', line.unitType);
      console.log('  Unit Value:', line.unitValue);
      console.log('  Weight:', line.smartAttributes?.weight);
      console.log('  Length:', line.smartAttributes?.length);
      console.log('  Finish:', line.smartAttributes?.finish);
    });
  }

  // 3. Save raw text to file for further analysis
  const outPath = path.join(__dirname, 'debug_raw_text.txt');
  fs.writeFileSync(outPath, rawText);
  console.log(`\n📄 Raw text saved to: ${outPath}`);
}

main().catch(console.error);
