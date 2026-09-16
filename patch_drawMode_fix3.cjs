const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/rs\(\);\n\n        \}\n\n    const ctx/m, 'rs();\n\n    const ctx');
fs.writeFileSync('app.js', js);
