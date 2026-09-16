const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const startIndex = js.indexOf('static updateUsersTabButton(ids = [], cache = {}) {');
const endIndex = js.indexOf('static forceSyncVideo(d = AppState.lastKnownSyncState) {');

if (startIndex > -1 && endIndex > -1) {
    const newFunc = `static updateUsersTabButton(ids = [], cache = {}) {
    const list = Array.isArray(ids) ? ids : [];
    const count = list.length;
    const countEl = Utils.$("users-count");
    if (countEl) {
       countEl.innerText = count.toString();
    }
  }\n\n  `;
    
    js = js.substring(0, startIndex) + newFunc + js.substring(endIndex);
    fs.writeFileSync('app.js', js);
    console.log("Successfully replaced");
} else {
    console.log("Not found");
}
