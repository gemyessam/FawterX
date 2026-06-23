const fs = require('fs');
const f = fs.readFileSync('backend/src/utils/smartParser.js', 'utf8');
const lines = f.split('\n');

const newLines = [
  "  // ── Strategy 3: noSpaceText fallback ──",
  "  if (!packingAmt || !freightAmt || !metadata.netAmount || !metadata.totalAmount) {",
  "    const noSp = text.replace(/\\s+/g, '').toUpperCase();",
  "    ",
  "    // Helper to extract the last valid currency-like value (ignores weights like 0.002)",
  "    const getValidLast = (re) => {",
  "      const m = [...noSp.matchAll(re)];",
  "      for (let i = m.length - 1; i >= 0; i--) {",
  "        const valStr = m[i][1];",
  "        if (valStr.includes('.') && valStr.split('.')[1].length > 2) continue; // Skip e.g., 0.002",
  "        return parseFloat(valStr.replace(/,/g, ''));",
  "      }",
  "      return null;",
  "    };",
  "    ",
  "    if (!packingAmt) { const v = getValidLast(/PACK(?:ING|AGING)?.{0,30}?([0-9]+[0-9,]*\\.[0-9]+)/g); if (v) packingAmt = v; }",
  "    if (!freightAmt) { const v = getValidLast(/FRE?IGHT.{0,30}?([0-9]+[0-9,]*\\.[0-9]+)/g); if (v) freightAmt = v; }",
  "    if (!metadata.netAmount) { const v = getValidLast(/NETAMOUNT.{0,30}?([0-9]+[0-9,]*\\.[0-9]+)/g); if (v) metadata.netAmount = v; }",
  "    if (!metadata.taxAmount) { const v = getValidLast(/VAT.{0,30}?([0-9]+[0-9,]*\\.[0-9]+)/g); if (v) metadata.taxAmount = v; }",
  "    if (!metadata.totalAmount) { const v = getValidLast(/TOTALAMOUNT.{0,30}?([0-9]+[0-9,]*\\.[0-9]+)/g); if (v) metadata.totalAmount = v; }",
  "    console.log('=== FOOTER STRATEGY 3 (noSpace fallback) ===', { packingAmt, freightAmt, netAmount: metadata.netAmount, totalAmount: metadata.totalAmount });",
  "  }"
];

// Replace lines 720-730 (0-indexed 719-729, which is 11 lines)
lines.splice(719, 11, ...newLines);

fs.writeFileSync('backend/src/utils/smartParser.js', lines.join('\n'));
console.log('Fixed Strategy 3!');
