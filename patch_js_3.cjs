const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /const joinDate = profile\.createdAt/g,
  `if (Utils.$("view-friends-count")) Utils.$("view-friends-count").innerText = "Друзей: " + friendsCount;\n    const joinDate = profile.createdAt`
);

fs.writeFileSync('app.js', appJs);
console.log("Patched friends count logic!");
