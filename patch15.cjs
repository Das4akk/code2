const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/html \+= \`<div style="display:flex; align-items:center; gap:5px; margin-top:4px;"><span style="font-size:10px;">VOL<\/span><input type="range" class="user-mic-vol" data-uid="\$\{uid\}" min="0" max="1" step="0\.05" value="\$\{RTCManager\.getUserVolume\(uid\) \|\| 1\}" style="width: 50px; height: 3px; cursor:pointer;"><\/div>\`;/, '');

js = js.replace(/container\.querySelectorAll\("\.user-mic-vol"\)\.forEach\(\(slider\) => \{[\s\S]*?\}\);/, '');

fs.writeFileSync('app.js', js);
