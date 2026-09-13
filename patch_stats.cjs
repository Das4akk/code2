const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const targetLine = `    const needsExpansion = safeBio.length > LIMIT;`;
const insertLines = `
    const statCreated = document.getElementById("view-stat-created");
    if (statCreated) {
       statCreated.innerText = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Неизвестно";
    }
    const statUid = document.getElementById("view-stat-uid");
    if (statUid) {
       statUid.innerText = targetUid || "Неизвестно";
    }
`;

code = code.replace(targetLine, insertLines + "\n" + targetLine);
fs.writeFileSync('app.js', code);
console.log("Stats patched in app.js.");
