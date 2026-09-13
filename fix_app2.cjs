const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/margin-right:6px;"><\/div>\$\{statusText\}`;/g, 'margin-right:6px;"></div>${statusText}`);');

fs.writeFileSync('app.js', code);
console.log("Fixed missing closing parenthesis.");
