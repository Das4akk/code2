const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/Utils\.\$\("reaction-layer"\)\.appendChild\(el\);/, `
    const overlay = Utils.$("room-video-overlay");
    if (overlay) overlay.appendChild(el);
    else document.body.appendChild(el);
`);

fs.writeFileSync('app.js', js);
