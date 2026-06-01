const fs = require('fs');

const mappings = {
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f510.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f468.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Man%20Technologist.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f469.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman%20Technologist.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f319.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/First%20Quarter%20Moon%20Face.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f504.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Up%20Button.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6aa.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/House.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4ce.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Briefcase.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4cc.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Reminder%20Ribbon.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2699.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Toolbox.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f42e.png': 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Cow.webp'
};

function processFile(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    let mod = false;
    for (const [oldUrl, newUrl] of Object.entries(mappings)) {
        if (content.includes(oldUrl)) {
            content = content.split(oldUrl).join(newUrl);
            mod = true;
            console.log(`Replaced in ${filename}: ${oldUrl.split('/').pop()} -> ${newUrl.split('/').pop()}`);
        }
    }
    if (mod) {
        fs.writeFileSync(filename, content);
    }
}

processFile('index.html');
processFile('app.js');
