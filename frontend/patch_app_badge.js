const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(/>v2\.14\.4</g, ">v2.14.5 (Batch Upload)<");
c = c.replace(/logo: 'فاوتر إكس',/, "logo: 'فاوتر إكس v2.14.5',");

fs.writeFileSync('src/App.jsx', c);
console.log("Updated App.jsx with Arabic version string and badge");
