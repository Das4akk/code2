const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Remove hardcoded margin-top JS logic from app.js
let appJs = fs.readFileSync('app.js', 'utf-8');
appJs = appJs.replace(
  /const profContainer = vModal\.querySelector\("\.tiktok-profile-container"\);\s*if \(profContainer\) profContainer\.style\.marginTop = "-90px";/g,
  `const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.add("has-banner");`
);
appJs = appJs.replace(
  /const profContainer = vModal\.querySelector\("\.tiktok-profile-container"\);\s*if \(profContainer\) profContainer\.style\.marginTop = "0";/g,
  `const profContainer = vModal.querySelector(".tiktok-profile-container");
            if (profContainer) profContainer.classList.remove("has-banner");`
);
fs.writeFileSync('app.js', appJs);

// Remove the hardcoded padding-top from .tiktok-profile-info in index.html
html = html.replace(
  /\.tiktok-profile-info \{\s*display: flex;\s*flex-direction: column;\s*flex: 1;\s*padding-top: 60px; \/\* Push text below banner on PC \*\/\s*\}/,
  `.tiktok-profile-info {
     display: flex;
     flex-direction: column;
     flex: 1;
  }`
);

// Add .has-banner rules
const hasBannerCSS = `
  .tiktok-profile-container.has-banner {
     margin-top: -90px;
  }
  .tiktok-profile-container.has-banner .tiktok-profile-info {
     padding-top: 60px;
  }
  @media (max-width: 768px) {
     .tiktok-profile-container.has-banner .tiktok-profile-info {
        padding-top: 0px !important;
     }
  }
`;

html = html.replace('</style>', hasBannerCSS + '\n</style>');
fs.writeFileSync('index.html', html);
console.log("Patched with has-banner CSS class");
