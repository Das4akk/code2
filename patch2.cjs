const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let newHtml = fs.readFileSync('room_screen_new.html', 'utf8');

const startIdx = html.indexOf('<section id="room-screen"');
const endStr = '</section>';
const endIdx = html.indexOf(endStr, startIdx) + endStr.length;

html = html.substring(0, startIdx) + newHtml + html.substring(endIdx);
fs.writeFileSync('index.html', html);
