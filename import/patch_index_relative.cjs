const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/id="support-active-ticket" style="display: none; flex-direction: column; height: 100%; overflow: hidden;"/, 'id="support-active-ticket" style="display: none; flex-direction: column; height: 100%; overflow: hidden; position: relative;"');

fs.writeFileSync('index.html', html);
