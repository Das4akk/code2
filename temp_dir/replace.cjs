const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');
let indexHtml = fs.readFileSync('index.html', 'utf8');

const replacements = [
    { from: 'https://em-content.zobj.net/source/telegram/386/star_2b50.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2b50.png' },
    { from: 'https://em-content.zobj.net/source/apple/391/fire_1f525.png', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png' },
    { from: 'https://em-content.zobj.net/source/apple/391/gem-stone_1f48e.png', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f48e.png' },
    { from: 'https://em-content.zobj.net/source/apple/391/crown_1f451.png', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f451.png' },
    { from: 'https://cdn.emoji.gg/emojis/3468-love.gif', to: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif' },
    { from: 'https://cdn.emoji.gg/emojis/5232-heart.gif', to: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
    { from: 'https://cdn.emoji.gg/emojis/4638-heart.gif', to: 'https://media.giphy.com/media/LpDmM2wSt6Hm5fKJVa/giphy.gif' },
    { from: 'https://cdn.emoji.gg/emojis/7697-ring.gif', to: 'https://media.giphy.com/media/Mous21IAhJQiI/giphy.gif' },
    { from: 'https://cdn.emoji.gg/emojis/1690-love-face-emoji.gif', to: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif' },
    { from: 'https://em-content.zobj.net/source/telegram/386/fire_1f525.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/shopping-bags_1f6cd-fe0f.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6cd.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/face-with-tears-of-joy_1f602.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f602.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/face-screaming-in-fear_1f631.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f631.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/red-heart_2764-fe0f.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/clapping-hands_1f44f.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f44f.png' },
    { from: 'https://em-content.zobj.net/source/telegram/386/musical-notes_1f3b6.webp', to: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3b6.png' }
];

for (let r of replacements) {
    appJs = appJs.split(r.from).join(r.to);
    indexHtml = indexHtml.split(r.from).join(r.to);
}

fs.writeFileSync('app.js', appJs);
fs.writeFileSync('index.html', indexHtml);
