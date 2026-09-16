const https = require('https');
const links = [
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Animals%20and%20Nature/Fire.webp",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20With%20Tears%20Of%20Joy.webp",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Face%20Screaming%20In%20Fear.webp",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Red%20Heart.webp",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Clapping%20Hands.webp"
];

links.forEach(url => {
  https.get(url, (res) => {
    console.log(res.statusCode, url);
  });
});
