const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const enterEvent = `
    document.querySelectorAll('#login-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Utils.$("btn-do-login").click();
        });
    });
    document.querySelectorAll('#reg-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Utils.$("btn-do-reg").click();
        });
    });
`;

code = code.replace(/Utils\.\$\("tab-reg-btn"\)\.onclick = \(\) => \{/, enterEvent + "\n    Utils.$(\"tab-reg-btn\").onclick = () => {");
fs.writeFileSync('app.js', code);
