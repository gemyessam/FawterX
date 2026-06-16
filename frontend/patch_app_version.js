const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(/logo: 'FawterX',/, "logo: 'FawterX v2.4.0',");

fs.writeFileSync('src/App.jsx', c);
console.log("Updated App.jsx with version in logo");
