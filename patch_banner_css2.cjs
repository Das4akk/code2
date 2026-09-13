const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /\.tiktok-profile-container \{ background: transparent !important;/,
  `.tiktok-profile-container { background: transparent !important; 
     position: relative; z-index: 2;`
);

fs.writeFileSync('index.html', html);
