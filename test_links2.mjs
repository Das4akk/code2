const urls = [
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Sky%20and%20Weather/Rainbow.webp',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Artist%20Palette.webp',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Rainbow.webp',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Symbols/Label.webp'
];
Promise.all(urls.map(url => fetch(url).then(r => {
  if (r.ok) console.log('EXISTS:', url);
  else console.log('BROKEN:', url);
})));
