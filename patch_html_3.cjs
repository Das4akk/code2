const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(/<div class="partner-container" id="view-partner-container"[^>]*><\/div>\s*/g, '');

fs.writeFileSync('index.html', html);
console.log("Removed partner container from HTML");
