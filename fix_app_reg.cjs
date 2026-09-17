const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/Utils\.toast\("Отправка кода на почту\.\.\.", "info"\);[\s\S]*?await this\.sendAuthCode\(email\);[\s\S]*?AppState\.pendingRegistration = \{ email, pass, name, username, gender \};[\s\S]*?this\.showRegVerifyPanel\(email\);[\s\S]*?Utils\.toast\("Введите код из письма", "success"\);/, `
        AppState.pendingRegistration = { email, pass, name, username, gender };
        
        if (AppState.admin.settings.emailVerificationBlocked) {
           Utils.toast("Верификация отключена. Регистрация завершается...", "info");
           await this.completeRegistration(AppState.pendingRegistration);
        } else {
           Utils.toast("Отправка кода на почту...", "info");
           await this.sendAuthCode(email);
           this.showRegVerifyPanel(email);
           Utils.toast("Введите код из письма", "success");
        }
`);

fs.writeFileSync('app.js', code);
