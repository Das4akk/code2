const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /id="profile-banner-wrapper" style="position: relative; width: 100%; aspect-ratio: 21 \/ 6; min-height: 120px; display: none; z-index: 1;"/,
  'id="profile-banner-wrapper" style="position: relative; width: 100%; aspect-ratio: 21 / 6; min-height: 120px; display: block; z-index: 1;"'
);

fs.writeFileSync('index.html', html);
console.log("Made banner block by default.");
