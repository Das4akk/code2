const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /const targetPartnerUid = await this\.getPartnerUid\(targetUid\); \/\/ \[NEW\]\s*await this\.renderPartnerContainer\(\s*"view-partner-container",\s*targetPartnerUid,\s*targetUid === AppState\.currentUser\.uid,\s*targetUid,\s*\); \/\/ \[UPDATE\]/,
  ''
);

fs.writeFileSync('app.js', appJs);
console.log("Removed renderPartnerContainer call from openViewProfileModal");
