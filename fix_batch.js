const fs = require('fs');

let batch = fs.readFileSync('frontend/src/components/BatchWorkflow.jsx', 'utf8');

// Ensure import
if (!batch.includes('SettingsContext')) {
  batch = batch.replace(
    `import React, { useState, useEffect } from 'react'`,
    `import React, { useState, useEffect, useContext } from 'react'\nimport { SettingsContext } from '../App'`
  );
} else {
  // if it already has SettingsContext from the failed first script:
  batch = batch.replace(
    `import { AppContext, SettingsContext } from '../App'`,
    `import { SettingsContext } from '../App'`
  );
  if (!batch.includes('useContext')) {
     batch = batch.replace(`import React, { useState, useEffect }`, `import React, { useState, useEffect, useContext }`);
  }
}

batch = batch.replace(
  `export default function BatchWorkflow({ lang, t, fetchUsage }) {`,
  `export default function BatchWorkflow({ lang, t, fetchUsage }) {\n  const settings = useContext(SettingsContext);`
);

fs.writeFileSync('frontend/src/components/BatchWorkflow.jsx', batch);
console.log("Fixed BatchWorkflow.jsx");
