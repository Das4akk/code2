const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Insert after the send-code route
code = code.replace(/app\.post\('\/api\/custom-auth\/send-code'[\s\S]*?\}\);/, `$&

// АДМИН: Создание пользователя
app.post('/api/admin/create-user', async (req, res) => {
    try {
        const { idToken, email, password, name, username, gender } = req.body;
        if (!idToken || !email || !password || !name || !username) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase Admin не инициализирован' });
        }
        
        // Верификация админа
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const adminProfileSnap = await admin.database().ref(\`users/\${decodedToken.uid}/profile\`).once('value');
        const adminProfile = adminProfileSnap.val();
        if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'creator' && adminProfile.role !== 'developer')) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const cleanName = username.toLowerCase().trim();
        const existingUsername = await admin.database().ref(\`usernames/\${cleanName}\`).once('value');
        if (existingUsername.exists()) {
            return res.status(400).json({ error: 'Имя пользователя уже занято' });
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        const profileData = {
            name,
            username: cleanName,
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
        };

        await admin.database().ref(\`users/\${userRecord.uid}/profile\`).set(profileData);
        await admin.database().ref(\`usernames/\${cleanName}\`).set(userRecord.uid);
        
        // Для туториала:
        await admin.database().ref(\`users/\${userRecord.uid}/force_tutorial\`).set(true);

        res.json({ success: true, uid: userRecord.uid });
    } catch (e) {
        console.error('Ошибка создания пользователя:', e);
        res.status(500).json({ error: e.message || 'Ошибка создания' });
    }
});`);

fs.writeFileSync('server.js', code);
