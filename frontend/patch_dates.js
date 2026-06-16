const fs = require('fs');

// Patch Home.jsx
let home = fs.readFileSync('src/pages/Home.jsx', 'utf8');
const homeTarget = `      for (let i = 0; i < etaDocs.length; i++) {
        const doc = etaDocs[i];
        
        // Clean the document recursively`;
const homeReplacement = `      const currentIsoTime = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');
      for (let i = 0; i < etaDocs.length; i++) {
        const doc = etaDocs[i];
        doc.dateTimeIssued = currentIsoTime;
        
        // Clean the document recursively`;
home = home.replace(homeTarget, homeReplacement);
fs.writeFileSync('src/pages/Home.jsx', home);

// Patch BatchWorkflow.jsx
let batch = fs.readFileSync('src/components/BatchWorkflow.jsx', 'utf8');
const batchTarget = `      // 2. Sign each document locally
      for (const doc of invoices) {
        // Remove internal _fileName before signing and submitting
        const { _fileName, ...pureDoc } = doc
        const cleanedDoc = cleanObject(pureDoc)`;
const batchReplacement = `      // 2. Sign each document locally
      const currentIsoTime = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');
      for (const doc of invoices) {
        // Remove internal _fileName before signing and submitting
        const { _fileName, ...pureDoc } = doc
        pureDoc.dateTimeIssued = currentIsoTime;
        const cleanedDoc = cleanObject(pureDoc)`;
batch = batch.replace(batchTarget, batchReplacement);
fs.writeFileSync('src/components/BatchWorkflow.jsx', batch);

console.log("Patched both Home.jsx and BatchWorkflow.jsx to override dateTimeIssued!");
