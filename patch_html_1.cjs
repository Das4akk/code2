const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// 1. Change Create Room button color to white
html = html.replace(/background-color: #EA284E !important; \/\* TikTok Red \*\/\s*color: white !important;/g, 'background-color: #FFFFFF !important; color: #000000 !important;');

// 2. Move DM button to be under view-status, and style it white
html = html.replace(
  /<div class="tiktok-profile-actions-wrap">[\s\S]*?<\/div>\s*<\/div>/,
  ''
);

// We need to find view-status and append the DM button there
const statusMatch = '<div id="view-status" style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px"></div>';
const dmButtonHtml = `
<div class="tiktok-profile-actions-wrap">
  <div id="view-profile-actions" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
    <button class="primary-btn" id="btn-dm-modal" style="background-color: #FFFFFF !important; color: #000000 !important; border: none; font-weight: 600;">
      Написать сообщение
    </button>
  </div>
</div>
`;

html = html.replace(statusMatch, statusMatch + '\n' + dmButtonHtml);

// 3. Add view-friends-count right after view-username
const usernameMatch = /<div id="view-username"[^>]*>\s*@user\s*<\/div>/;
const friendsCountHtml = `\n<div id="view-friends-count" style="color: var(--text-muted); font-size: 15px; margin-bottom: 12px; font-weight: 500;">Друзей: 0</div>`;
html = html.replace(usernameMatch, match => match + friendsCountHtml);

// 4. Also fix top right avatar '?' by leaving it empty since app.js will populate it
html = html.replace('<div class="avatar" id="lobby-app-bar-avatar">?</div>', '<div class="avatar" id="lobby-app-bar-avatar"></div>');

fs.writeFileSync('index.html', html);
console.log("Patched index.html structure and styles!");
