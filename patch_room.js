const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/<div class="room-shell">[\s\S]*?<div class="chat-section glass-panel">/, (match) => {
    // We will replace this section manually later.
    return match;
});
