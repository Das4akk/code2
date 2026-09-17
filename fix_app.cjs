const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/Utils\.\$\("btn-admin-global-reg-lock"\)\.onclick = \(\) =>[\s\S]*?this\.toggleGlobalSetting\("maintenanceMode", "Maintenance mode"\);/, `Utils.$("btn-admin-global-reg-lock").onclick = () =>
      this.toggleGlobalSetting("globalRegistrationsBlocked", "Блок регистраций");
    Utils.$("btn-admin-global-email-verify-lock").onclick = () =>
      this.toggleGlobalSetting("emailVerificationBlocked", "Блок вериф. почты");
    Utils.$("btn-admin-global-maintenance").onclick = () =>
      this.toggleGlobalSetting("maintenanceMode", "Maintenance mode");`);

code = code.replace(/setBtn\([\s\S]*?"btn-admin-global-reg-lock"[\s\S]*?"globalRegistrationsBlocked"[\s\S]*?"Блок регистраций"[\s\S]*?setBtn\(/, `setBtn(
      "btn-admin-global-reg-lock",
      "globalRegistrationsBlocked",
      "Блок регистраций",
    );
    setBtn(
      "btn-admin-global-email-verify-lock",
      "emailVerificationBlocked",
      "Блок вериф. почты",
    );
    setBtn(`);

fs.writeFileSync('app.js', code);
