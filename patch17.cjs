const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/grid-template-columns: 1fr 280px;/, 'grid-template-columns: 1fr 260px;');
fs.writeFileSync('index.html', html);
