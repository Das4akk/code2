const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const targetLine = `    const statUid = document.getElementById("view-stat-uid");`;
const insertLines = `
    const statLastLogin = document.getElementById("view-stat-login");
    if (statLastLogin) {
       statLastLogin.innerText = profile.lastLoginDate || "Неизвестно";
    }
`;

code = code.replace(targetLine, insertLines + "\n" + targetLine);
fs.writeFileSync('app.js', code);
console.log("Stats2 patched in app.js.");
