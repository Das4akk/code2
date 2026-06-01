const fs = require('fs');

async function fix() {
    console.log('Fetching tree...');
    const res = await fetch('https://api.github.com/repos/Tarikul-Islam-Anik/Telegram-Animated-Emojis/git/trees/main?recursive=1');
    const data = await res.json();
    const tree = data.tree;
    
    // Create a map of filename to correct path
    const fileMap = {};
    for (const item of tree) {
        if (item.type === 'blob' && item.path.endsWith('.webp')) {
            const parts = item.path.split('/');
            const name = parts[parts.length - 1];
            fileMap[name] = item.path;
        }
    }

    const processFile = (filename) => {
        let content = fs.readFileSync(filename, 'utf8');
        const regex = /https:\/\/raw\.githubusercontent\.com\/Tarikul-Islam-Anik\/Telegram-Animated-Emojis\/main\/([^'"]+)/g;
        let modified = false;
        content = content.replace(regex, (match, path) => {
            const decodedPath = decodeURIComponent(path);
            const name = decodedPath.split('/').pop();
            const correctPath = fileMap[name];
            if (correctPath && decodedPath !== correctPath) {
                console.log(`Fixing ${decodedPath} -> ${correctPath} in ${filename}`);
                modified = true;
                return `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${correctPath.split('/').map(c => encodeURIComponent(c)).join('/')}`;
            }
            return match;
        });
        
        if (modified) {
            fs.writeFileSync(filename, content);
            console.log(`Saved ${filename}`);
        }
    };

    processFile('index.html');
    processFile('app.js');
}

fix().catch(console.error);
