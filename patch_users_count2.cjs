const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/static updateUsersTabButton\([\s\S]*? \}\n  \}/m, `static updateUsersTabButton(ids = [], cache = {}) {
    const list = Array.isArray(ids) ? ids : [];
    const count = list.length;
    const countEl = Utils.$("users-count");
    if (countEl) {
       countEl.innerText = count.toString();
    }
  }`);
fs.writeFileSync('app.js', js);
