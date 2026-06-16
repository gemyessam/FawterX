const fs = require('fs');
let c = fs.readFileSync('src/components/UploadStep.jsx', 'utf8');
c = c.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/components/UploadStep.jsx', c);
