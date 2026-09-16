const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="room-top-bar glass-panel" style="display: flex; align-items: center; justify-content: flex-start; gap: 24px; padding: 16px 24px; background: transparent; border-bottom: none;">/g;
html = html.replace(regex, '<div class="room-top-bar glass-panel" style="display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 24px; background: transparent; border-bottom: none;">');

fs.writeFileSync('index.html', html);
