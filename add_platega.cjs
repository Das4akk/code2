const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const anchor = '<div id="lobby-theme-slot">';
const replacement = `<div style="text-align: center; font-size: 12px; font-weight: bold; color: var(--text-muted); margin-bottom: 8px; margin-top: 8px; letter-spacing: 0.5px; text-transform: uppercase;">platega верификация</div>\n            <div id="lobby-theme-slot">`;

code = code.replace(anchor, replacement);
fs.writeFileSync('index.html', code);
