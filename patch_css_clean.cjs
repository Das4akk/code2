const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// The black square might also be caused by background: var(--bg-main) on .lobby-layout or .rooms-main
html = html.replace(/\.rooms-main\s*\{[^}]*background-color:\s*var\(--bg-main\);[^}]*\}/g, '');
html = html.replace(/\.lobby-layout\s*\{[^}]*background-color:\s*var\(--bg-main\);[^}]*\}/g, '.lobby-layout { margin-top: 60px; height: calc(100vh - 60px); }');

fs.writeFileSync('index.html', html);
console.log("Cleaned bg main overrides");
