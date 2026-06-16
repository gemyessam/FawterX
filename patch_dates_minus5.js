const fs = require('fs');

// Patch Home.jsx
let home = fs.readFileSync('frontend/src/pages/Home.jsx', 'utf8');
const homeTarget = `      const currentIsoTime = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');`;
const homeReplacement = `      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      const currentIsoTime = safeDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');`;
home = home.replace(homeTarget, homeReplacement);
fs.writeFileSync('frontend/src/pages/Home.jsx', home);

// Patch BatchWorkflow.jsx
let batch = fs.readFileSync('frontend/src/components/BatchWorkflow.jsx', 'utf8');
const batchTarget = `      const currentIsoTime = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');`;
const batchReplacement = `      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      const currentIsoTime = safeDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');`;
batch = batch.replace(batchTarget, batchReplacement);
fs.writeFileSync('frontend/src/components/BatchWorkflow.jsx', batch);

console.log("Patched both Home.jsx and BatchWorkflow.jsx to use minus 5 mins currentIsoTime!");
