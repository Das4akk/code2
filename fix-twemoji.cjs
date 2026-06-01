const fs = require('fs');

const fixMap = {
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Closed%20Lock%20With%20Key.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f510.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Man.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f468.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Woman.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f469.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Crescent%20Moon.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f319.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Counterclockwise%20Arrows%20Button.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f504.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Door.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6aa.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Paperclip.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4ce.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Pushpin.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4cc.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Gear.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2699.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Cow%20Face.webp': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f42e.png'
};

const processFile = (filename) => {
    let content = fs.readFileSync(filename, 'utf8');
    let modified = false;
    
    for (const [broken, fixed] of Object.entries(fixMap)) {
        if (content.includes(broken)) {
            content = content.replaceAll(broken, fixed);
            modified = true;
            console.log(`Fixed ${broken} in ${filename}`);
        }
    }
    
    if (modified) {
        fs.writeFileSync(filename, content);
    }
};

processFile('index.html');
processFile('app.js');
