const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/console\.error\("Like error", err\);/g, 'console.error("Like error", err); Utils.toast(err.message, "error");');

fs.writeFileSync('app.js', js);
console.log("Added toast for errors.");
