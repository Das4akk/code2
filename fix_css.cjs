const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace mobile absolute positioning for actions wrap
const badCss = /\.tiktok-profile-side-col \.tiktok-profile-actions-wrap {\s*position: absolute !important;\s*top: 10px !important;\s*right: 8px !important;\s*width: auto !important;\s*}/;
const goodCss = `.tiktok-profile-side-col .tiktok-profile-actions-wrap {
      position: static !important;
      margin-top: 16px !important;
      margin-bottom: 16px !important;
      justify-content: flex-start !important;
      width: 100% !important;
    }`;

html = html.replace(badCss, goodCss);
fs.writeFileSync('index.html', html);
console.log("CSS fixed.");
