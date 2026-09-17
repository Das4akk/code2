const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(/\/\/ АДМИН: Создание пользователя[\s\S]*?\}\);\n\n/, '');
fs.writeFileSync('server.js', code);
