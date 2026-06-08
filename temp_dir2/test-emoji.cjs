const https = require('https');
https.get('https://api.github.com/repos/Tarikul-Islam-Anik/Telegram-Animated-Emojis/git/trees/main?recursive=1', {
  headers: { 'User-Agent': 'Node.js' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const list = JSON.parse(data);
    if(list.tree) {
      list.tree.forEach(i => {
        if(i.path.toLowerCase().includes('gear') || i.path.toLowerCase().includes('setting')) {
          console.log(i.path);
        }
      });
    }
  });
});
