const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /\.tiktok-profile-actions-wrap \{\s*position: absolute !important;\s*top: 0 !important;\s*left: 0 !important;\s*margin: 0 !important;\s*justify-content: flex-start !important;\s*\}/,
  `.tiktok-profile-actions-wrap:has(.secondary-btn) {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        justify-content: flex-start !important;
     }
     .tiktok-profile-actions-wrap:has(.primary-btn) {
        position: static !important;
        margin-top: 15px !important;
        width: 100%;
     }`
);

fs.writeFileSync('index.html', html);
console.log("Patched actions wrap CSS for conditional positioning");
