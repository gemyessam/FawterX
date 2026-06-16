const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.jsx', 'utf8');

c = c.replace(/v1\.8\.2/g, 'v1.8.3');

fs.writeFileSync('src/pages/Home.jsx', c);
console.log("Updated Home.jsx to display signer v1.8.3");
