const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('index.html', 'utf-8');
const $ = cheerio.load(html, { decodeEntities: false, recognizeSelfClosing: true });

let styleBlock = $('#tiktok-redesign').html();

// Remove the modal-like styling for #section-profile and its theme variants
styleBlock = styleBlock.replace(/#section-profile\s*\{[\s\S]*?flex-direction:\s*column;\s*text-align:\s*left;\s*\}/g, '');
styleBlock = styleBlock.replace(/html\.theme-light-global\s*#section-profile\s*\{[\s\S]*?\}/g, '');
styleBlock = styleBlock.replace(/@media \(max-width:\s*768px\)\s*\{\s*#section-profile\s*\{[\s\S]*?padding:\s*20px\s*!important;\s*\}/g, '@media (max-width: 768px) {');

// Just to be sure, forcefully wipe out any bad #section-profile blocks before the very end
styleBlock = styleBlock.replace(/#section-profile\s*\{[^}]*width:\s*90vw[^}]*\}/g, '');

$('#tiktok-redesign').html(styleBlock);

fs.writeFileSync('index.html', $.html());
console.log("Cleaned up CSS for #section-profile");
