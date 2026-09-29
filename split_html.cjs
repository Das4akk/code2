const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync('index.html', 'utf8');

// Ensure css directory exists
if (!fs.existsSync('css')) {
  fs.mkdirSync('css', { recursive: true });
}

// Extract main styles block (lines between <style> and </style>)
const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
let styles = [];
let match;
while ((match = styleRegex.exec(htmlContent)) !== null) {
  styles.push(match[1]);
}

console.log(`Found ${styles.length} style blocks.`);

// Save all extracted CSS into modular CSS files:
// 1. css/main.css (all base styles, themes, and glass panel styles)
// 2. css/room.css
// 3. css/modals.css
// 4. css/admin.css

// Let's create css/main.css containing the extracted styles
const combinedCss = styles.join('\n\n/* =================================================== */\n\n');
fs.writeFileSync('css/main.css', combinedCss, 'utf8');
console.log(`Saved css/main.css (${Math.round(combinedCss.length / 1024)} KB)`);

// Replace all <style>...</style> blocks in HTML with clean <link rel="stylesheet" href="/css/main.css">
let cleanHtml = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

// Insert link tags in <head>
const linkTag = `
    <!-- COWIO Modular Stylesheets -->
    <link rel="stylesheet" href="/css/main.css">
`;

cleanHtml = cleanHtml.replace('</head>', `${linkTag}\n</head>`);

// Clean up extra blank lines
cleanHtml = cleanHtml.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync('index.html', cleanHtml, 'utf8');
console.log(`Updated index.html: reduced to ${cleanHtml.split('\n').length} lines!`);
