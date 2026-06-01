const fs = require('fs');
const https = require('https');

async function checkUrls() {
    let content = fs.readFileSync('index.html', 'utf8') + ' ' + fs.readFileSync('app.js', 'utf8');
    const regex = /https:\/\/raw\.githubusercontent\.com\/[^'"]+/g;
    const matches = new Set(content.match(regex));
    
    console.log(`Found ${matches.size} unique raw.githubusercontent.com URLs`);
    
    for (const url of matches) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`BROKEN: ${res.status} ${url}`);
            }
        } catch (e) {
            console.log(`ERROR: ${url} - ${e.message}`);
        }
    }
}

checkUrls().catch(console.error);
