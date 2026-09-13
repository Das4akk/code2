const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Replace Utils.$("view-bio").innerHTML = with document.querySelectorAll(".view-bio").forEach(el => el.innerHTML = ...);
code = code.replace(/Utils\.\$\("view-bio"\)\.innerHTML\s*=\s*`/g, 'document.querySelectorAll(".view-bio").forEach(el => el.innerHTML = `');

// Now we need to append the closing parenthesis for the forEach loops that we just opened.
// The string ends with ` ;  or  `;
code = code.replace(/      `;\n      if \(Utils\.\$\("view-avatar"\)\)/g, '      `);\n      if (Utils.$("view-avatar"))');
code = code.replace(/      `;\n      if \(Utils\.\$\("view-status"\)\)/g, '      `);\n      if (Utils.$("view-status"))');
code = code.replace(/      `;\n    setTimeout/g, '      `);\n    setTimeout');

// 2. Replace Utils.$("view-status").innerHTML = with document.querySelectorAll(".view-status").forEach(el => el.innerHTML = ...);
code = code.replace(/if\s*\(Utils\.\$\("view-status"\)\)\s*Utils\.\$\("view-status"\)\.innerHTML\s*=\s*`/g, 'document.querySelectorAll(".view-status").forEach(el => el.innerHTML = `');
code = code.replace(/Utils\.\$\("view-status"\)\.innerHTML\s*=\s*`/g, 'document.querySelectorAll(".view-status").forEach(el => el.innerHTML = `');

// Fix closing parenthesis for view-status
code = code.replace(/<\/div>`;\n      if \(Utils\.\$\("view-streak"\)\)/g, '</div>`);\n      if (Utils.$("view-streak"))');
code = code.replace(/<\/div>`;\n    \} else \{/g, '</div>`);\n    } else {');
code = code.replace(/<\/div>`;\n    if \(!profile\.background\)/g, '</div>`);\n    if (!profile.background)');

// 3. Add profile stats updates
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
    const statLastLogin = document.getElementById("view-stat-login");
    if (statLastLogin) {
       statLastLogin.innerText = profile.lastLoginDate || "Неизвестно";
    }
`;
code = code.replace(targetLine, insertLines + "\n" + targetLine);

fs.writeFileSync('app.js', code);
console.log("App.js fixed successfully.");
