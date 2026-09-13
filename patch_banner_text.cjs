const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /\.tiktok-profile-info \{/,
  `.tiktok-profile-info {
        padding-top: 60px; /* Push text below banner on PC */`
);

// On mobile, tiktok-profile-info already has padding-right, but let's reset padding-top for mobile so it doesn't get pushed too far down.
html = html.replace(
  /\.tiktok-profile-info \{\s*display: block !important;\s*padding-right: 110px !important;\s*\}/,
  `.tiktok-profile-info {
        display: block !important;
        padding-right: 110px !important;
        padding-top: 0px !important;
     }`
);

fs.writeFileSync('index.html', html);
console.log("Patched PC text padding");
