const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

c = c.replace(/v1\.7\.8/g, 'v1.7.9');

fs.writeFileSync('signer.cs', c);
console.log("Updated signer.cs to v1.7.9");
