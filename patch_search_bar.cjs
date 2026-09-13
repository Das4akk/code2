const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Update CSS
html = html.replace(
  /\.tiktok-search-container \{\s*flex: 1;\s*display: flex;\s*justify-content: center;\s*max-width: 500px;\s*margin: 0 20px;\s*\}/,
  `.tiktok-search-container {
    flex: 1;
    display: flex;
    justify-content: center;
    max-width: none;
    margin: 0 20px;
  }`
);

// Remove spacer
html = html.replace(
  '<div class="lobby-app-bar-spacer" style="flex: 1;"></div>',
  ''
);

fs.writeFileSync('index.html', html);
console.log("Stretched search bar");
