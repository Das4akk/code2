const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/\\\`usernames\/\$\{cleanName\}\\\`/g, '"usernames/" + cleanName');
code = code.replace(/\\\`users\/\$\{uid\}\/profile\/email\\\`/g, '"users/" + uid + "/profile/email"');

fs.writeFileSync('app.js', code);
