const fs = require('fs');

// Keep the parsed invoice date unless it is missing.
let home = fs.readFileSync('src/pages/Home.jsx', 'utf8');
const homeTarget = `      for (let i = 0; i < etaDocs.length; i++) {
        const doc = etaDocs[i];
        if (!doc.dateTimeIssued) {
          const safeDate = new Date();
          safeDate.setMinutes(safeDate.getMinutes() - 5);
          doc.dateTimeIssued = safeDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');
        }
        
        // Clean the document recursively`;
const homeReplacement = homeTarget;
home = home.replace(homeTarget, homeReplacement);
fs.writeFileSync('src/pages/Home.jsx', home);

let batch = fs.readFileSync('src/components/BatchWorkflow.jsx', 'utf8');
const batchTarget = `      // 2. Sign each document locally
      for (const doc of invoices) {
        // Remove internal _fileName before signing and submitting
        const { _fileName, ...pureDoc } = doc
        if (!pureDoc.dateTimeIssued) {
          const safeDate = new Date();
          safeDate.setMinutes(safeDate.getMinutes() - 5);
          pureDoc.dateTimeIssued = safeDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');
        }
        const cleanedDoc = cleanObject(pureDoc)`;
const batchReplacement = batchTarget;
batch = batch.replace(batchTarget, batchReplacement);
fs.writeFileSync('src/components/BatchWorkflow.jsx', batch);

console.log("Date override patch is now neutralized; existing dates are preserved.");
