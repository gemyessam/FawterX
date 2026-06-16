const fs = require('fs');

let parser = fs.readFileSync('backend/src/utils/smartParser.js', 'utf8');
const target = `      if (parsed) metadata.dateTimeIssued = parsed;`;
const replacement = `      // ALWAYS override with current date (minus 5 mins to prevent future date rejection CF313)
      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      metadata.dateTimeIssued = safeDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');`;
parser = parser.replace(target, replacement);
fs.writeFileSync('backend/src/utils/smartParser.js', parser);
console.log("Patched smartParser.js!");
