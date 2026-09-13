const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Revert mobile to original padding-top: 0
html = html.replace(
  /\.tiktok-profile-info \{\s*padding-top: 60px; \/\* Push text below banner on PC \*\/\s*display: block !important;\s*padding-right: 110px !important;\s*\}/,
  `.tiktok-profile-info {
        display: block !important;
        padding-right: 110px !important;
        padding-top: 0px !important;
     }`
);

// Apply to PC
html = html.replace(
  /\.tiktok-profile-info \{\s*display: flex;\s*flex-direction: column;\s*flex: 1;\s*\}/,
  `.tiktok-profile-info {
     display: flex;
     flex-direction: column;
     flex: 1;
     padding-top: 60px; /* Push text below banner on PC */
  }`
);

fs.writeFileSync('index.html', html);
console.log("Fixed profile info padding");
