import fs from 'fs';

let registryContent = fs.readFileSync('./emojis_registry.js', 'utf8');
registryContent = registryContent.replace('const ANIMATED_EMOJIS =', '').replace(/;\s*$/, '');
const EMOJIS = JSON.parse(registryContent);

const files = ['app.js', 'telegram_dm.js', 'telegram_dm_inject.js', 'index.html', 'siteTips.js'];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    const regex = /https:\/\/raw\.githubusercontent\.com\/Tarikul-Islam-Anik\/Telegram-Animated-Emojis\/main\/([^\/]+)\/([^\.]+)\.webp/g;
    
    let matches = 0;
    content = content.replace(regex, (match, folder, fileName) => {
        const target = fileName + '.webp';
        const correctUrl = EMOJIS.find(url => url.endsWith('/' + target));
        if (correctUrl && correctUrl !== match) {
            matches++;
            return correctUrl;
        }
        return match;
    });
    
    if (matches > 0) {
        fs.writeFileSync(file, content);
        console.log(`Replaced ${matches} URLs in ${file}`);
    }
});
