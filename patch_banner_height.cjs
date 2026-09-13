const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /id="profile-banner-wrapper" style="position: relative; width: 100%; height: 220px;/g,
  'id="profile-banner-wrapper" style="position: relative; width: 100%; height: 180px;'
);

fs.writeFileSync('index.html', html);
console.log("Patched banner height");
