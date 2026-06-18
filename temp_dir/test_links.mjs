import fs from 'fs';
const text = fs.readFileSync('premiumManager.js', 'utf8');
const urls = [...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/[^"']+/g)].map(v => v[0]);
Promise.all([...new Set(urls)].map(url => fetch(url).then(r => {
  if (!r.ok) console.log('BROKEN:', url);
}).catch(e => console.log('ERROR:', url)))).then(() => console.log('Done'));
