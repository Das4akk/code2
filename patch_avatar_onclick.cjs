const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  '<div class="lobby-app-bar-user" id="lobby-app-bar-profile">',
  '<div class="lobby-app-bar-user" id="lobby-app-bar-profile" onclick="if(window.AppState && window.AppState.currentUser && window.ProfileManager) { window.ProfileManager.openViewProfileModal(window.AppState.currentUser.uid); }">'
);

fs.writeFileSync('index.html', html);
console.log("Added inline onclick to avatar");
