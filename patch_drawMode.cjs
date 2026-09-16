const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const regex = /\/\/ Add toggle button to top bar[\s\S]*?dbg\.onclick = \(\) => \{[\s\S]*?\};\n/m;
js = js.replace(regex, '');
fs.writeFileSync('app.js', js);
