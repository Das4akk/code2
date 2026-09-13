const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /#section-profile \{\s*padding: 24px;/g,
  '#section-profile {\n       padding: 0 !important;'
);

fs.writeFileSync('index.html', html);
console.log("Patched section-profile padding for mobile");
