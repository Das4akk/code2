import { nameToEmoji } from 'gemoji';
import fs from 'fs';

const EMOJIS = fs.readFileSync('emojis_registry.js', 'utf8');
const urls = [];
const regex = /"(.+?)"/g;
let match;
while ((match = regex.exec(EMOJIS)) !== null) {
  urls.push(match[1]);
}

const map = {};
urls.forEach(url => {
  let name = url.split('/').pop().replace('.webp', '').replace(/\%20/g, ' ').toLowerCase();
  
  // gemoji uses names like "thumbs up", sometimes "thumbs_up"
  // Try to find the emoji
  let emoji = nameToEmoji[name] || nameToEmoji[name.replace(/ /g, '_')] || "⏺️";
  if (!emoji) {
    // Custom fallback heuristics
    if (name === "smiling face with hearts") emoji = "🥰";
    else if (name.includes("heart")) emoji = "❤️";
    else if (name.includes("face")) emoji = "😀";
    else emoji = "✨";
  }
  map[url] = emoji;
});

fs.writeFileSync('generated_emojis.json', JSON.stringify(map, null, 2));
