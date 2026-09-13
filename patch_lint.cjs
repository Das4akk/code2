const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  `  } // [UPDATE]
  } // [UPDATE]`,
  `  }`
);

fs.writeFileSync('app.js', appJs);
console.log("Fixed syntax error");
