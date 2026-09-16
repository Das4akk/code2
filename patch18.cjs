const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/Utils\.\$\("mic-btn"\)\.disabled = !pVoice;/g, '');
fs.writeFileSync('app.js', js);
