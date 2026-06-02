const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/ProfileManager\.openProfile\('/g, "ProfileManager.openProfileModal('");

fs.writeFileSync('app.js', app);
