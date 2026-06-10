const q1 = "https://api.github.com/search/code?q=repo:Tarikul-Islam-Anik/Telegram-Animated-Emojis+Rainbow.webp";
const q2 = "https://api.github.com/search/code?q=repo:Tarikul-Islam-Anik/Telegram-Animated-Emojis+Label.webp";
Promise.all([q1, q2].map(u => fetch(u, {headers: {'User-Agent': 'tester'}}).then(r => r.json()))).then(res => console.log(JSON.stringify(res, null, 2)));
