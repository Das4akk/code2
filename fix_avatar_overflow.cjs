const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/#view-avatar\s*{\s*width: 110px !important;\s*height: 110px !important;\s*border-radius: 50% !important;\s*border: 6px solid #101116 !important;\s*box-shadow: 0 8px 24px rgba\(0, 0, 0, 0\.6\) !important;\s*overflow: hidden !important;/g, 
  '#view-avatar {\n    width: 110px !important;\n    height: 110px !important;\n    border-radius: 50% !important;\n    border: 6px solid #101116 !important;\n    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;\n    overflow: visible !important;');

fs.writeFileSync('index.html', html);
console.log("Fixed overflow for #view-avatar.");
