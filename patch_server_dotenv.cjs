const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Добавляем импорт dotenv в самое начало
if (!code.includes('dotenv/config') && !code.includes('import dotenv')) {
    code = "import 'dotenv/config';\n" + code;
}

fs.writeFileSync('server.js', code);
