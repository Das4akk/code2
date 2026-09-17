const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// replace (vals) => { with async (vals) => { in showAdminPrompt callbacks where I added await
code = code.replace(/\(vals\) => \{\n\s*const target = await resolveAdminTarget/, 'async (vals) => {\n        const target = await resolveAdminTarget');
code = code.replace(/\(vals\) => \{\n\s*const puppetUid = await resolveAdminTarget/, 'async (vals) => {\n        const puppetUid = await resolveAdminTarget');
code = code.replace(/\(vals\) => \{\n\s*const curUid = await resolveAdminTarget/, 'async (vals) => {\n        const curUid = await resolveAdminTarget');

fs.writeFileSync('app.js', code);
