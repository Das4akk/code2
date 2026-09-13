const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// The black square might also be coming from .tiktok-profile-container or .tiktok-profile-header
html = html.replace(/\.tiktok-profile-container\s*\{/g, '.tiktok-profile-container { background: transparent !important; ');

fs.writeFileSync('index.html', html);
console.log("Forced transparent background on profile container");
