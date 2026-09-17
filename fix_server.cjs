const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// The injected code is between:
// // АДМИН: Создание пользователя
// ...
// });
// 
//         const code = Math.floor...

const regex = /\/\/ АДМИН: Создание пользователя[\s\S]*?\}\);\n\n/;
const match = code.match(regex);
if (match) {
    let adminRoute = match[0];
    code = code.replace(regex, ""); // remove from current place
    // find the end of send-code route or just put it before send-code route
    code = code.replace(/\/\/ Отправка 6-значного кода/, adminRoute + "\n// Отправка 6-значного кода");
    fs.writeFileSync('server.js', code);
    console.log("Fixed!");
} else {
    console.log("Not found");
}
