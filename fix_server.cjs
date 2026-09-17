const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regex = /const profileData = \{[\s\S]*?\/\/ Для туториала:\s*await admin\.database\(\)\.ref\(\`users\/\$\{userRecord\.uid\}\/force_tutorial\`\)\.set\(true\);\s*res\.json\(\{ success: true, uid: userRecord\.uid \}\);\s*\} catch \(e\) \{\s*console\.error\('Ошибка создания пользователя:', e\);\s*res\.status\(500\)\.json\(\{ error: e\.message \|\| 'Ошибка создания' \}\);\s*\}\}\);/m;

code = code.replace(regex, '');
fs.writeFileSync('server.js', code);
