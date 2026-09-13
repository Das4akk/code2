const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// There might be background colors set on .lobby-layout or .lobby-content in the tiktok-redesign block
html = html.replace(/\.lobby-layout\s*\{[^}]*background-color:\s*var\(--bg-main\);[^}]*\}/, 
  '.lobby-layout { margin-top: 60px; height: calc(100vh - 60px); background: transparent !important; }'
);

html = html.replace(/\.lobby-content\s*\{[^}]*background-color:\s*var\(--bg-main\);[^}]*\}/g, 
  '.lobby-content { background: transparent !important; }'
);

// We need to also clean up any other #121212 backgrounds in the rewrite block.
html = html.replace(/background:\s*#121212\s*!important;/g, 'background: transparent !important;');
html = html.replace(/background:\s*#FFFFFF\s*!important;/g, 'background: transparent !important;');

fs.writeFileSync('index.html', html);
console.log("Removed black squares");
