const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(/vidContainer\.style\.borderRadius = document\.fullscreenElement \? "0" : "20px";\n        \}\n      \}\);/g, 'vidContainer.style.borderRadius = document.fullscreenElement ? "0" : "20px";\n        }\n      };');

fs.writeFileSync('app.js', js);
