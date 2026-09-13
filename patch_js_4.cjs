const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

appJs = appJs.replace(
  /<strong style="color:var\(--text-main\);">Статистика:<\/strong><br>\s*Друзей: \$\{friendsCount\}<br>\s*На платформе с: \$\{joinDate\}/,
  ''
);

fs.writeFileSync('app.js', appJs);
console.log("Cleaned up old stats from bio!");
