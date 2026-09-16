const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/document\.addEventListener\("fullscreenchange", \(\) => \{/g, 'document.onfullscreenchange = () => {');

fs.writeFileSync('app.js', js);
