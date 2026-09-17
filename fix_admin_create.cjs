const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/<div class="godmode-section" data-section="security"/, `
                <div class="godmode-section" data-section="security" style="border:1px solid var(--border-light); border-radius:16px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom: 10px;">
                    <div style="font-weight:700; margin-bottom:10px;">Создание аккаунта</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <input type="email" id="admin-create-email" class="admin-form-input" placeholder="Email" />
                        <input type="text" id="admin-create-name" class="admin-form-input" placeholder="Имя" />
                        <input type="text" id="admin-create-username" class="admin-form-input" placeholder="Юзернейм (@id)" />
                        <input type="password" id="admin-create-password" class="admin-form-input" placeholder="Пароль" />
                        <select id="admin-create-gender" class="admin-form-input">
                            <option value="male">Мужской</option>
                            <option value="female">Женский</option>
                        </select>
                        <button class="primary-btn" id="btn-admin-create-account" style="margin-top:10px;">Создать аккаунт (тихо)</button>
                    </div>
                </div>
                <div class="godmode-section" data-section="security"`);

code = code.replace(/Utils\.\$\("btn-admin-clear-audit"\)\.onclick = \(\) => this\.clearAuditLog\(\);/, `Utils.$("btn-admin-clear-audit").onclick = () => this.clearAuditLog();
    
    Utils.$("btn-admin-create-account").onclick = async () => {
        const email = Utils.$("admin-create-email").value.trim();
        const name = Utils.$("admin-create-name").value.trim();
        const username = Utils.$("admin-create-username").value.trim().replace("@", "");
        const password = Utils.$("admin-create-password").value.trim();
        const gender = Utils.$("admin-create-gender").value;
        
        if (!email || !name || !username || password.length < 6) return Utils.toast("Заполните все поля, пароль от 6 символов", "error");
        
        Utils.$("btn-admin-create-account").disabled = true;
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(AuthManager.getApiBase() + "/api/admin/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: token, email, name, username, password, gender })
            });
            const data = await res.json();
            if (data.success) {
                Utils.toast("Аккаунт успешно создан!", "success");
                Utils.$("admin-create-email").value = "";
                Utils.$("admin-create-name").value = "";
                Utils.$("admin-create-username").value = "";
                Utils.$("admin-create-password").value = "";
            } else {
                Utils.toast(data.error || "Ошибка создания", "error");
            }
        } catch (e) {
            Utils.toast(e.message, "error");
        }
        Utils.$("btn-admin-create-account").disabled = false;
    };`);

fs.writeFileSync('app.js', code);
