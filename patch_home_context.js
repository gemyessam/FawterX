const fs = require('fs');

let home = fs.readFileSync('frontend/src/pages/Home.jsx', 'utf8');

// 1. Add settings to useContext
home = home.replace(
  `const { lang, t, resetTrigger, triggerReset } = useContext(AppContext)`,
  `const { lang, t, resetTrigger, triggerReset, settings } = useContext(AppContext)`
);

// 2. Replace line 283
home = home.replace(
  `    const saved = localStorage.getItem('companySettings')\n    const config = saved ? JSON.parse(saved) : {}`,
  `    const config = settings || {}`
);

// 3. Replace line 557
home = home.replace(
  `      const saved = localStorage.getItem('companySettings')\n      const config = saved ? JSON.parse(saved) : {}`,
  `      const config = settings || {}`
);

// 4. Replace line 1058
home = home.replace(
  `                const settings = JSON.parse(localStorage.getItem('companySettings') || '{}')\n                const hasKeys = settings.clientId && settings.clientSecret1 && settings.clientSecret2\n                return !hasKeys || !settings.isVerified`,
  `                const config = settings || {}\n                const hasKeys = config.clientId && config.clientSecret1 && config.clientSecret2\n                return !hasKeys || !config.isVerified`
);

fs.writeFileSync('frontend/src/pages/Home.jsx', home);
console.log("Patched Home.jsx");
