const fs = require('fs');

// 1. App.jsx
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Add SettingsContext export
app = app.replace(
  `export const AppContext = createContext(null)`,
  `export const AppContext = createContext(null)\nexport const SettingsContext = createContext(null)`
);

// Wrap Layout return with SettingsContext
app = app.replace(
  `  return (\n    <div className=\`app-wrapper \${lang === 'en' ? 'ltr-layout' : ''}\`>`,
  `  return (\n    <SettingsContext.Provider value={settings}>\n    <div className=\`app-wrapper \${lang === 'en' ? 'ltr-layout' : ''}\`>`
);

// Close SettingsContext
app = app.replace(
  `        </div>\n      )}\n    </div>\n  )\n}`,
  `        </div>\n      )}\n    </div>\n    </SettingsContext.Provider>\n  )\n}`
);

// Remove settings from AppContext
app = app.replace(
  `AppContext.Provider value={{ lang, setLang, t, user, handleLogout, resetTrigger, triggerReset, showTutorialModal, setShowTutorialModal, settings }}`,
  `AppContext.Provider value={{ lang, setLang, t, user, handleLogout, resetTrigger, triggerReset, showTutorialModal, setShowTutorialModal }}`
);

fs.writeFileSync('frontend/src/App.jsx', app);

// 2. Home.jsx
let home = fs.readFileSync('frontend/src/pages/Home.jsx', 'utf8');
home = home.replace(
  `import { AppContext } from '../App'`,
  `import { AppContext, SettingsContext } from '../App'`
);
home = home.replace(
  `const { lang, t, resetTrigger, triggerReset, settings } = useContext(AppContext)`,
  `const { lang, t, resetTrigger, triggerReset } = useContext(AppContext)\n  const settings = useContext(SettingsContext)`
);
fs.writeFileSync('frontend/src/pages/Home.jsx', home);

// 3. BatchWorkflow.jsx
let batch = fs.readFileSync('frontend/src/components/BatchWorkflow.jsx', 'utf8');
batch = batch.replace(
  `import { AppContext } from '../App'`,
  `import { AppContext, SettingsContext } from '../App'`
);
batch = batch.replace(
  `const { lang, settings } = useContext(AppContext)`,
  `const { lang } = useContext(AppContext)\n  const settings = useContext(SettingsContext)`
);
fs.writeFileSync('frontend/src/components/BatchWorkflow.jsx', batch);

console.log("Fixed context logic!");
