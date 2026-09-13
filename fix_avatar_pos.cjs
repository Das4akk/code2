const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Add position: relative !important; to #view-avatar css blocks
html = html.replace(/#view-avatar {\s*width: 120px !important;/g, '#view-avatar {\n     position: relative !important;\n     width: 120px !important;');
html = html.replace(/#view-avatar {\n    width: 110px !important;/g, '#view-avatar {\n    position: relative !important;\n    width: 110px !important;');
html = html.replace(/#view-avatar {\n      width: 90px !important;/g, '#view-avatar {\n      position: relative !important;\n      width: 90px !important;');

// Add position: relative; to the inline style
html = html.replace(/id="view-avatar" style="/, 'id="view-avatar" style="position: relative;');

fs.writeFileSync('index.html', html);
console.log("Added position: relative to #view-avatar.");
