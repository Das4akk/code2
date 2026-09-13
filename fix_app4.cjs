const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const lines = code.split('\n');
for (let i = 8665; i < 8685; i++) {
  if (lines[i] && lines[i].includes('        `;')) {
    lines[i] = lines[i].replace('        `;', '        `);');
    console.log('Fixed line: ' + (i+1));
  }
}

fs.writeFileSync('app.js', lines.join('\n'));
