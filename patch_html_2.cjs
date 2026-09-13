const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Remove the blue + icon css
html = html.replace(/\/\* \+ icon on avatar \*\/[\s\S]*?(?=\/\* Title block on the left \*\/)/, '');

fs.writeFileSync('index.html', html);
console.log("Removed blue + icon css");
