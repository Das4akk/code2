const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(/\.tiktok-profile-container\.has-banner /g, '.tiktok-profile-container ');
html = html.replace(/\.tiktok-profile-container\.has-banner/g, '.tiktok-profile-container');

fs.writeFileSync('index.html', html);
console.log("Removed .has-banner dependence in CSS.");
