import fs from 'fs';
import { gemoji } from 'gemoji';

const EMOJIS = fs.readFileSync('emojis_registry.js', 'utf8');
const urls = [];
const regex = /"(.+?)"/g;
let match;
while ((match = regex.exec(EMOJIS)) !== null) {
  urls.push(match[1]);
}

const map = {};
urls.forEach(url => {
  let originalName = url.split('/').pop().replace('.webp', '').replace(/%20/g, ' ').toLowerCase();
  
  let found = null;
  // first try exact match in description or names
  found = gemoji.find(g => g.description.toLowerCase() === originalName || g.names.includes(originalName));
  // then substring match
  if (!found) {
    found = gemoji.find(g => g.description.toLowerCase().includes(originalName) || originalName.includes(g.description.toLowerCase()));
  }
  // hardcode some fallbacks
  if (!found) {
    if (originalName.includes('party popper')) found = { emoji: '🎉' };
    if (originalName.includes('soccer')) found = { emoji: '⚽' };
    if (originalName.includes('television')) found = { emoji: '📺' };
    if (originalName.includes('heart')) found = { emoji: '❤️' };
    if (originalName.includes('face')) found = { emoji: '😀' };
    if (originalName.includes('fire')) found = { emoji: '🔥' };
    if (originalName.includes('star')) found = { emoji: '⭐' };
    if (originalName.includes('hand')) found = { emoji: '👋' };
  }

  map[url] = found ? found.emoji : '✨';
});

fs.writeFileSync('generated_emojis.json', JSON.stringify(map, null, 2));
