const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

// Update lobby avatar in bindMyProfileListener
appJs = appJs.replace(
  'Utils.$("my-avatar-display").innerHTML = ProfileManager.getAvatarHtml(p);',
  'Utils.$("my-avatar-display").innerHTML = ProfileManager.getAvatarHtml(p);\n      if(Utils.$("lobby-app-bar-avatar")) Utils.$("lobby-app-bar-avatar").innerHTML = ProfileManager.getAvatarHtml(p);'
);

// Remove share / settings buttons injection
appJs = appJs.replace(
  /\/\/ Also inject a settings button and share button next to it![\s\S]*?(?=    \} else \{)/,
  ''
);

appJs = appJs.replace(
  /const wrap = actionBtn.parentElement;[\s\S]*?(?=const myFriendsSnap)/,
  ''
);

// Remove love proposal references
appJs = appJs.replace(/const loveBtn = Utils\.\$\("btn-love-proposal"\);[^\n]*\n/g, '');
appJs = appJs.replace(/const removePartnerBtn = Utils\.\$\("btn-remove-partner"\);[^\n]*\n/g, '');
appJs = appJs.replace(/if \(loveBtn\) loveBtn.style.display = "none";[^\n]*\n/g, '');
appJs = appJs.replace(/if \(removePartnerBtn\) removePartnerBtn.style.display = "none";[^\n]*\n/g, '');
appJs = appJs.replace(/let isFriendForLove = false;[^\n]*\n/g, '');
appJs = appJs.replace(/isFriendForLove = isFriend;[^\n]*\n/g, '');
appJs = appJs.replace(/await this\.updateLoveProfileActions\(targetUid, isFriendForLove\);[^\n]*\n/g, '');

fs.writeFileSync('app.js', appJs);
console.log("Patched app.js successfully!");
