const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

const startStr = 'if (Utils.$("nav-profile"))';
const endStr = 'if (Utils.$("btn-switch-account")) {';

const startIndex = appJs.indexOf(startStr);
const endIndex = appJs.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const before = appJs.substring(0, startIndex);
    const after = appJs.substring(endIndex);
    
    const newBlock = `
    if (Utils.$("lobby-app-bar-profile")) {
      Utils.$("lobby-app-bar-profile").onclick = () => {
         const uid = AppState.currentUser?.uid;
         if (uid) ProfileManager.openViewProfileModal(uid);
      };
    }
    if (Utils.$("nav-profile")) {
      Utils.$("nav-profile").onclick = () => {
         const uid = AppState.currentUser?.uid;
         if (uid) {
             ProfileManager.openViewProfileModal(uid);
         }
      };
    }
    `;
    
    fs.writeFileSync('app.js', before + newBlock + after);
    console.log("Successfully replaced the block!");
} else {
    console.log("Could not find start or end index.");
}
