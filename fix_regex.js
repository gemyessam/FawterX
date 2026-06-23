const fs = require('fs');
const f = fs.readFileSync('backend/src/utils/smartParser.js', 'utf8');
const lines = f.split('\n');

// Replace lines 673-680 (0-indexed: 672-679) with properly escaped regex literals
const newLines = [
  '  // Strategy 1: Full-text currency-qualified regex (using literals)',
  '  const allMatchesLit = (re, src) => { const m = [...src.matchAll(re)]; return m.length ? parseFloat(m[m.length - 1][1].replace(/,/g, "")) : null; };',
  '  let p1 = allMatchesLit(/Packing\\s+(?:EUR|USD|GBP|EGP|SAR|AED)\\s+([\\d,]+\\.\\d+)/gi, text);',
  '  let f1 = allMatchesLit(/Fre?ight\\s+(?:EUR|USD|GBP|EGP|SAR|AED)\\s+([\\d,]+\\.\\d+)/gi, text);',
  '  let n1 = allMatchesLit(/Net\\s*Amount\\s+(?:EUR|USD|GBP|EGP|SAR|AED)\\s+([\\d,]+\\.\\d+)/gi, text);',
  '  let v1 = allMatchesLit(/VAT\\s+(?:EUR|USD|GBP|EGP|SAR|AED)\\s+([\\d,]+\\.\\d+)/gi, text);',
  '  let t1 = allMatchesLit(/Total\\s*Amount\\s+(?:EUR|USD|GBP|EGP|SAR|AED)\\s+([\\d,]+\\.\\d+)/gi, text);',
  '',
  '  const allMatches = allMatchesLit;',
];

// Replace lines 673-681 (0-indexed 672-680)
lines.splice(672, 9, ...newLines);

fs.writeFileSync('backend/src/utils/smartParser.js', lines.join('\n'));
console.log('Fixed regex escaping! Lines replaced:', 673, '-', 681);
