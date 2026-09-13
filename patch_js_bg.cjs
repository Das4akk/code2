const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(/vModal\.querySelector\("\.modal-content"\)/g, 'vModal.querySelector(".tiktok-profile-container") || vModal');

fs.writeFileSync('app.js', appJs);
console.log("Patched background application!");
