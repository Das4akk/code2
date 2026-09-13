const fs = require('fs');

// We need to clean up how applyProfileBackground works in app.js
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /static applyProfileBackground\(panel,\s*background\s*=\s*""\)\s*\{[\s\S]*?\n\s*\}/m,
  `static applyProfileBackground(panel, background = "") {
    // Disabled profile backgrounds per user request
    if (panel) {
       panel.style.background = 'transparent';
    }
  }`
);

// We should also remove the edit background options from the edit profile modal UI
appJs = appJs.replace(
  /<div class="form-group">\s*<label><img src="https:\/\/raw.githubusercontent.com\/Tarikul-Islam-Anik\/Telegram-Animated-Emojis\/main\/Travel%20and%20Places\/Night%20with%20Stars.webp".*?<\/div>\s*<\/div>/g,
  ''
);

fs.writeFileSync('app.js', appJs);

let html = fs.readFileSync('index.html', 'utf-8');
// Remove solid backgrounds on #section-profile and body
html = html.replace(/html:not\(\.theme-light-global\) body \{\s*background-color: #121212 !important;\s*\}/, '');
html = html.replace(/html\.theme-light-global body \{\s*background-color: #FFFFFF !important;\s*\}/, '');

fs.writeFileSync('index.html', html);
console.log("Removed profile backgrounds!");
