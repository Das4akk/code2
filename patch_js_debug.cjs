const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /if \(uid\) ProfileManager\.openViewProfileModal\(uid\);/g,
  `if (uid) {
    ProfileManager.openViewProfileModal(uid).catch(err => {
      Utils.toast("Error opening profile: " + err.message, "error");
      console.error(err);
    });
  }`
);

fs.writeFileSync('app.js', appJs);
console.log("Injected error catchers");
