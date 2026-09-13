const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<div class="tiktok-profile-main-col">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="tiktok-profile-side-col">/);
if (match) console.log(match[0].substring(0, 1000));
