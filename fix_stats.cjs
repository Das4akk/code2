const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const original = `<div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
             <span style="color: var(--text-muted);">ID пользователя:</span>
             <span id="view-stat-uid" style="color: #fff; font-weight: 600; font-family: monospace; font-size: 11px;"></span>
          </div>`;
          
const replaced = original + `
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
             <span style="color: var(--text-muted);">Последний вход:</span>
             <span id="view-stat-login" style="color: #fff; font-weight: 600;">Неизвестно</span>
          </div>`;

html = html.replace(original, replaced);
fs.writeFileSync('index.html', html);
console.log("Updated HTML with last login.");
