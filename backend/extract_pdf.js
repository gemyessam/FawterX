const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const buf = fs.readFileSync('C:/Users/GeMy/Documents/System and Electronic Invoice/System invoice 610.PDF');
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  const text = result.text || '';
  // Print the first 5000 chars so we can see the format
  console.log(text.slice(0, 5000));
  console.log('\n\n--- FULL LINE COUNT:', text.split('\n').length);
}

main().catch(console.error);
