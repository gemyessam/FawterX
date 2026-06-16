const fs = require('fs');
let c = fs.readFileSync('signer.cs.v177_clean', 'utf16le');
c = c.replace(/v1\.7\.7/g, 'v1.8.4');
fs.writeFileSync('signer.cs', c, 'utf8');
console.log("REVERTED signer.cs completely to 76ebef2 (v1.7.7) and bumped to v1.8.4!");
