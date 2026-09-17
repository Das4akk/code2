const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const oldLogic = `Utils.\\$\\("btn-admin-create-account"\\)\\.onclick = async \\(\\) => \\{[\\s\\S]*?Utils.\\$\\("btn-admin-create-account"\\)\\.disabled = false;
    \\};`;

const newLogic = `Utils.$("btn-admin-create-account").onclick = async () => {
        const email = Utils.$("admin-create-email").value.trim();
        const name = Utils.$("admin-create-name").value.trim();
        const username = Utils.$("admin-create-username").value.trim().replace("@", "").toLowerCase();
        const password = Utils.$("admin-create-password").value.trim();
        const gender = Utils.$("admin-create-gender").value;
        
        if (!email || !name || !username || password.length < 6) return Utils.toast("Заполните все поля, пароль от 6 символов", "error");
        
        Utils.$("btn-admin-create-account").disabled = true;
        try {
            const existing = await get(ref(db, \`usernames/\${username}\`));
            if (existing.exists()) throw new Error("Юзернейм уже занят");
            
            const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
            const { getAuth, createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            
            const tempApp = initializeApp(app.options, "TempApp_" + Date.now());
            const tempAuth = getAuth(tempApp);
            
            const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
            const newUid = cred.user.uid;
            
            await set(ref(db, \`users/\${newUid}/profile\`), {
                name,
                username,
                email,
                bio: "",
                avatar: "",
                gender: gender || "male",
                registeredIp: "created_by_admin",
                background: { color: "#111111", index: 1, url: "", dim: 0.5 },
                hashtags: [],
                createdAt: Date.now(),
                provider: "email",
                emailVerified: true
            });
            await set(ref(db, \`usernames/\${username}\`), newUid);
            await set(ref(db, \`users/\${newUid}/force_tutorial\`), true);
            
            await tempAuth.signOut();
            await deleteApp(tempApp);
            
            Utils.toast("Аккаунт успешно создан!", "success");
            Utils.$("admin-create-email").value = "";
            Utils.$("admin-create-name").value = "";
            Utils.$("admin-create-username").value = "";
            Utils.$("admin-create-password").value = "";
        } catch (e) {
            Utils.toast(e.message, "error");
        }
        Utils.$("btn-admin-create-account").disabled = false;
    };`;

code = code.replace(new RegExp(oldLogic), newLogic);
fs.writeFileSync('app.js', code);
