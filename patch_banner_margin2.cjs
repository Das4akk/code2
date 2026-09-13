const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(/profContainer\.style\.marginTop = "-60px";/g, 'profContainer.style.marginTop = "-90px";');

fs.writeFileSync('app.js', appJs);
console.log("Patched banner margins to -90px");
