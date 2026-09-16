const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/\/\/ Add Admin button in room if admin[\s\S]*?roomAdminBtn\.onclick = \(\) => AdminPanel\.show\(\);\s*\}\s*\}/, '');
fs.writeFileSync('app.js', js);
