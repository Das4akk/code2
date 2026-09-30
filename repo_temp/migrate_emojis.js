import fs from 'fs';

const files = [
  "index.html",
  "js/admin.js",
  "js/auth.js",
  "js/catalog.js",
  "js/effects.js",
  "js/emojis.js",
  "js/library.js",
  "js/lumens.js",
  "js/media.js",
  "js/premium.js",
  "js/profile.js",
  "js/room.js",
  "js/security.js",
  "js/settings.js",
  "js/social.js",
  "js/support.js",
  "js/utils.js"
];

let totalReplaced = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace GitHub raw with jsDelivr CDN
  const rawPattern = /https:\/\/raw\.githubusercontent\.com\/Tarikul-Islam-Anik\/Telegram-Animated-Emojis\/main\//g;
  const count = (content.match(rawPattern) || []).length;
  if (count > 0) {
    content = content.replace(rawPattern, 'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/');
    totalReplaced += count;
  }

  // Fix broken Compass emoji
  if (content.includes('Objects/Compass.webp')) {
    content = content.replace(/Objects\/Compass\.webp/g, 'Travel%20and%20Places/Compass.webp');
    console.log(`Fixed Objects/Compass.webp in ${file}`);
  }

  // Replace old email
  if (content.includes('das4akk@gmail.com')) {
    content = content.replace(/das4akk@gmail.com/g, 'cowiosupport@gmail.com');
    console.log(`Replaced email in ${file}`);
  }

  fs.writeFileSync(file, content, 'utf8');
}

console.log(`Replacement complete! Total emoji URLs updated to jsDelivr: ${totalReplaced}`);
