const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let chatInput = fs.readFileSync('chat_input.html', 'utf8');

// Insert chatInput just before </div></div></div></div></section> at the end of room-screen
html = html.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/, chatInput + '\n</div></div></div></div></section>');
fs.writeFileSync('index.html', html);
