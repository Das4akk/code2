const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Replace the stubs for btn-settings and btn-forgot-password
appJs = appJs.replace(/if\s*\(Utils\.\$\("btn-forgot-password"\)\)\s*\{[\s\S]*?Utils\.\$\("btn-do-login"\)\.onclick = async \(\) => \{/m, 
`if (Utils.$("btn-forgot-password")) {
      Utils.$("btn-forgot-password").onclick = async () => {
        const email = Utils.$("login-email").value.trim();
        if(!email) return Utils.toast("Введите почту для сброса", "error");
        
        Utils.toast("Отправка кода...", "info");
        try {
            const apiBase = typeof window !== "undefined" && window.COWIO_MEDIA_API ? String(window.COWIO_MEDIA_API).replace(/\\/$/, "") : "";
            const res = await fetch(\`\${apiBase}/api/auth/send-code\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const code = await Utils.prompt("Код отправлен на " + email + ". Введите 6-значный код из письма:");
            if (!code) return Utils.toast("Сброс отменен", "error");

            const newPassword = await Utils.prompt("Введите новый пароль (минимум 6 символов):");
            if (!newPassword || newPassword.length < 6) return Utils.toast("Пароль слишком короткий или сброс отменен", "error");

            const resetRes = await fetch(\`\${apiBase}/api/auth/reset-password\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });

            const resetData = await resetRes.json();
            if (!resetData.success) throw new Error(resetData.error);

            Utils.toast("Пароль успешно изменен! Теперь вы можете войти.", "success");
        } catch (e) {
            Utils.toast(e.message || "Ошибка сброса", "error");
        }
      };
    }

    if (Utils.$("btn-settings-change-email")) {
      Utils.$("btn-settings-change-email").onclick = async () => {
        const newEmail = Utils.$("settings-new-email").value.trim();
        if(!newEmail) return Utils.toast("Введите новую почту", "error");
        if(!AppState.currentUser || !AppState.currentUser.email) return Utils.toast("Вы не авторизованы", "error");

        Utils.toast("Отправка кода на " + newEmail + "...", "info");
        try {
            const apiBase = typeof window !== "undefined" && window.COWIO_MEDIA_API ? String(window.COWIO_MEDIA_API).replace(/\\/$/, "") : "";
            const res = await fetch(\`\${apiBase}/api/auth/send-code\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const code = await Utils.prompt("Введите 6-значный код из письма на " + newEmail + ":");
            if (!code) return;

            const changeRes = await fetch(\`\${apiBase}/api/auth/change-email\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldEmail: AppState.currentUser.email, newEmail, code })
            });

            const changeData = await changeRes.json();
            if (!changeData.success) throw new Error(changeData.error);

            Utils.$("settings-new-email").value = "";
            Utils.toast("Почта успешно изменена! Рекомендуем перезайти в аккаунт.", "success");
        } catch (e) {
            Utils.toast(e.message || "Ошибка", "error");
        }
      }
    }

    if (Utils.$("btn-settings-change-password")) {
      Utils.$("btn-settings-change-password").onclick = async () => {
        const newPassword = Utils.$("settings-new-password").value.trim();
        if(!newPassword || newPassword.length < 6) return Utils.toast("Введите новый пароль (не менее 6 символов)", "error");
        if(!AppState.currentUser || !AppState.currentUser.email) return Utils.toast("Вы не авторизованы", "error");
        const email = AppState.currentUser.email;

        Utils.toast("Отправка кода на вашу текущую почту...", "info");
        try {
            const apiBase = typeof window !== "undefined" && window.COWIO_MEDIA_API ? String(window.COWIO_MEDIA_API).replace(/\\/$/, "") : "";
            const res = await fetch(\`\${apiBase}/api/auth/send-code\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const code = await Utils.prompt("Введите 6-значный код из письма (" + email + "):");
            if (!code) return;

            const resetRes = await fetch(\`\${apiBase}/api/auth/reset-password\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });

            const resetData = await resetRes.json();
            if (!resetData.success) throw new Error(resetData.error);

            Utils.$("settings-new-password").value = "";
            Utils.toast("Пароль успешно изменен!", "success");
        } catch (e) {
            Utils.toast(e.message || "Ошибка", "error");
        }
      }
    }

    Utils.$("btn-do-login").onclick = async () => {`);

fs.writeFileSync('app.js', appJs);
