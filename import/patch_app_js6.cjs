const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(/    else \{\n            Utils\.toast\('Пользователь НЕ ЗАБЛОКИРОВАН', 'success'\);\n        \}\n    \}/, '');

fs.writeFileSync('app.js', app);
