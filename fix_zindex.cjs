const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(
  /right: 32px !important;\s*margin: 0 !important;/,
  'right: 32px !important;\n     margin: 0 !important;\n     z-index: 20 !important;'
);

fs.writeFileSync('index.html', html);
