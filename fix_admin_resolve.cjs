const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const helper = `
  const resolveAdminTarget = async (val) => {
    if (!val) return val;
    val = val.trim();
    if (val === 'all') return val;
    const clean = val.replace('@', '').toLowerCase();
    const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => get(ref(getDatabase(), \`usernames/\${clean}\`)));
    return snap.exists() ? snap.val() : val;
  };
`;

code = code.replace(/window\.executeAdminAction = async function \(action\) \{/, "window.executeAdminAction = async function (action) {" + helper);

// forceTutorial
code = code.replace(/const target = vals\[0\]\.trim\(\);/, 'const target = await resolveAdminTarget(vals[0]);');
code = code.replace(/UID пользователя \(или 'all'\)/, "@id пользователя (или 'all')");

// puppeteer
code = code.replace(/const puppetUid = vals\[0\]\.trim\(\);/, 'const puppetUid = await resolveAdminTarget(vals[0]);');
code = code.replace(/UID пользователя \(оставьте пустым для отключения\)/, "@id пользователя (оставьте пустым для отключения)");

// uwuCurse
code = code.replace(/const curUid = vals\[0\]\.trim\(\);/, 'const curUid = await resolveAdminTarget(vals[0]);');
code = code.replace(/UID пользователя"/, '@id пользователя"');

// teleport
code = code.replace(/const uid = vals\[0\]\.trim\(\);/, 'const uid = await resolveAdminTarget(vals[0]);');
code = code.replace(/UID пользователя для телепортации/, "@id пользователя для телепортации");

fs.writeFileSync('app.js', code);
