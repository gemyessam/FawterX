const fs = require('fs');

let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Replace the buggy dependency array
app = app.replace(
  `    }
  }, [user, showSettingsModal])`,
  `    }
  }, [user])`
);

fs.writeFileSync('frontend/src/App.jsx', app);
console.log("Fixed App.jsx dependency array");
