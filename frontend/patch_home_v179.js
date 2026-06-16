const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.jsx', 'utf8');

c = c.replace(/v1\.7\.8/g, 'v1.7.9');

fs.writeFileSync('src/pages/Home.jsx', c);
console.log("Updated Home.jsx to display signer v1.7.9");
