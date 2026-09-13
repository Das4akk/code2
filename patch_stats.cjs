const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Remove the fake stats
html = html.replace(/<div class="tiktok-profile-stats">[\s\S]*?<\/div>/, '');

fs.writeFileSync('index.html', html);
console.log("Removed fake stats!");
