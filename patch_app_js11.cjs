const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/window\.onload = \(\) => \{\n    \}, 2000\);/, 'window.onload = () => {');

fs.writeFileSync('app.js', app);
