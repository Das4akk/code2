const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(/UserProfile\.openViewProfileModal/g, 'ProfileManager.openViewProfileModal');
appJs = appJs.replace(/UserProfile\.openEditProfileModal/g, 'ProfileManager.openEditProfileModal');

fs.writeFileSync('app.js', appJs);
console.log("Fixed UserProfile to ProfileManager!");
