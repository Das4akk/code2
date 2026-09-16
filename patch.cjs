const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/grid-template-columns:\s*1fr\s+380px;/, 'grid-template-columns: 1fr 280px;');
fs.writeFileSync('index.html', html);
