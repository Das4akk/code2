const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

const methodStart = `static async openViewProfileModal(targetUid) {`;
const replaced = `static async openViewProfileModal(targetUid) {
  try {
`;

appJs = appJs.replace(methodStart, replaced);

// Find the end of openViewProfileModal
// It ends around line 8868.
// Let's just find `    await this.updateLoveProfileActions(targetUid, isFriendForLove);` and wrap shortly after.
// Actually, using a regex to replace `btn.onclick = () => ProfileManager.openViewProfileModal(msg.uid);` with catch is easier.
