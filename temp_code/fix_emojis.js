const fs = require('fs');

const EMOJI_MAP = {
    'memo_1f4dd.webp': 'memo_1f4dd.png',
    'sparkles_2728.webp': 'sparkles_2728.png',
    'crescent-moon_1f319.webp': 'crescent-moon_1f319.png',
    'speech-balloon_1f4ac.webp': 'speech-balloon_1f4ac.png',
    'busts-in-silhouette_1f465.webp': 'busts-in-silhouette_1f465.png',
    'bust-in-silhouette_1f464.webp': 'bust-in-silhouette_1f464.png',
    'television_1f4fa.webp': 'television_1f4fa.png',
    'magnifying-glass-tilted-left_1f50d.webp': 'magnifying-glass-tilted-left_1f50d.png',
    'sun_2600-fe0f.webp': 'sun_2600-fe0f.png',
    'counterclockwise-arrows-button_1f504.webp': 'counterclockwise-arrows-button_1f504.png',
    'door_1f6aa.webp': 'door_1f6aa.png',
    'closed-lock-with-key_1f510.webp': 'closed-lock-with-key_1f510.png',
    'fire_1f525.webp': 'fire_1f525.png',
    'face-with-tears-of-joy_1f602.webp': 'face-with-tears-of-joy_1f602.png',
    'face-screaming-in-fear_1f631.webp': 'face-screaming-in-fear_1f631.png',
    'red-heart_2764-fe0f.webp': 'red-heart_2764-fe0f.png',
    'clapping-hands_1f44f.webp': 'clapping-hands_1f44f.png',
    'artist-palette_1f3a8.webp': 'artist-palette_1f3a8.png',
    'crown_1f451.webp': 'crown_1f451.png',
    'gear_2699-fe0f.webp': 'gear_2699-fe0f.png',
    'star_2b50.webp': 'star_2b50.png',
    'pushpin_1f4cc.webp': 'pushpin_1f4cc.png',
    'musical-note_1f3b5.webp': 'musical-note_1f3b5.png',
    'speaker-high-volume_1f50a.webp': 'speaker-high-volume_1f50a.png',
    'bell-with-slash_1f515.webp': 'bell-with-slash_1f515.png',
    'bell_1f514.webp': 'bell_1f514.png'
};

function replaceEmojis(content) {
    let newContent = content;
    // target em-content apple urls and replace base url to emojigraph + change webp to png
    for (const [oldUrl, newTarget] of Object.entries(EMOJI_MAP)) {
        newContent = newContent.replace(
            new RegExp(`https://em-content\\.zobj\\.net/source/apple/391/${oldUrl}`, 'g'),
            `https://emojigraph.org/media/apple/${newTarget}`
        );
    }
    return newContent;
}

const html = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('index.html', replaceEmojis(html));

const js = fs.readFileSync('app.js', 'utf8');
fs.writeFileSync('app.js', replaceEmojis(js));

console.log("Replaced emojis to Emojigraph format!");
