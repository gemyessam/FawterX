const fs = require('fs');

// 1. Home.jsx
let home = fs.readFileSync('frontend/src/pages/Home.jsx', 'utf8');

home = home.replace(
  `const { lang, t, user, resetTrigger, showTutorialModal, setShowTutorialModal } = useContext(AppContext)`,
  `const { lang, t, user, resetTrigger, showTutorialModal, setShowTutorialModal } = useContext(AppContext)\n  const settings = useContext(SettingsContext)`
);

fs.writeFileSync('frontend/src/pages/Home.jsx', home);
console.log("Fixed Home.jsx");
