import fs from 'fs';

async function run() {
    const res = await fetch('https://api.github.com/repos/Tarikul-Islam-Anik/Telegram-Animated-Emojis/git/trees/main?recursive=1');
    const data = await res.json();
    const webps = data.tree.filter(t => t.path.endsWith('.webp') && !t.path.includes('.DS_Store')).map(t => 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/' + t.path.split('/').map(encodeURIComponent).join('/'));
    fs.writeFileSync('emojis_registry.js', 'const ANIMATED_EMOJIS = ' + JSON.stringify(webps, null, 4) + ';\n');
    console.log('Saved ' + webps.length + ' emojis to emojis_registry.js');
}

run();
