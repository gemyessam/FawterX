const fs = require('fs');

let batch = fs.readFileSync('frontend/src/components/BatchWorkflow.jsx', 'utf8');

// 1. Add settings to useContext
batch = batch.replace(
  `const { lang } = useContext(AppContext)`,
  `const { lang, settings } = useContext(AppContext)`
);

// 2. Replace line 95
batch = batch.replace(
  `      const saved = localStorage.getItem('companySettings')\n      const config = saved ? JSON.parse(saved) : {}`,
  `      const config = settings || {}`
);

fs.writeFileSync('frontend/src/components/BatchWorkflow.jsx', batch);
console.log("Patched BatchWorkflow.jsx");
