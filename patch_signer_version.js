const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

c = c.replace(/v1\.7\.7/g, 'v1.7.8');

fs.writeFileSync('signer.cs', c);
