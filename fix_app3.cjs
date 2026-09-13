const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/        `;\n    setTimeout/g, '        `);\n    setTimeout');

fs.writeFileSync('app.js', code);
console.log("Fixed 8673 missing parenthesis.");
