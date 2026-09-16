const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
    /<div id="room-video-overlay".*?<\/div>/, 
    '<div id="room-video-overlay" style="position: absolute; inset: 0; z-index: 8; pointer-events: none; overflow: hidden;"></div>'
);

fs.writeFileSync('index.html', html);
