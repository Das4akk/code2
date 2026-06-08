const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const authCode = `
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// ----------------------------------------------------
// НАСТРОЙКА FIREBASE ADMIN И ПОЧТЫ (ДЛЯ СБРОСА ПАРОЛЯ)
// ----------------------------------------------------
try {
    // Внимание для создателя: чтобы это заработало, нужно поместить файл serviceAccountKey.json в корень проекта.
    // Если его нет, firebase-admin не запустится, но сервер не упадет (будет ошибка при попытке сброса).
    if (fs.existsSync('./serviceAccountKey.json')) {
        const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[COWIO] Firebase Admin SDK успешно запущен!');
    } else {
        console.warn('[COWIO] ВНИМАНИЕ: serviceAccountKey.json не найден. Сброс пароля/почты работать не будет!');
    }
} catch (e) {
    console.error('[COWIO] Ошибка инициализации Firebase Admin:', e);
}

// Настройка Nodemailer (транспортер)
// Для Gmail нужно использовать App Passwords (Пароли приложений)
const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER || 'ваша_почта@gmail.com',
        pass: process.env.SMTP_PASS || 'ваш_app_password'
    }
});

// Хранилище кодов в памяти (в реальном проекте лучше использовать Redis)
const verificationCodes = new Map();

// Отправка 6-значного кода
app.post('/api/auth/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email не указан' });

        const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        
        verificationCodes.set(email, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
        });

        const mailOptions = {
            from: process.env.SMTP_USER || 'ваша_почта@gmail.com',
            to: email,
            subject: 'Код подтверждения COWIO',
            html: \`
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #111; color: #fff; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #ff8fc6; text-align: center;">COWIO</h2>
                    <p style="font-size: 16px;">Ваш код подтверждения:</p>
                    <div style="font-size: 32px; font-weight: bold; padding: 15px; background: #222; text-align: center; border-radius: 10px; letter-spacing: 5px;">
                        \${code}
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 20px;">Код действителен 10 минут. Если вы не запрашивали код, проигнорируйте это письмо.</p>
                </div>
            \`
        };

        await mailTransporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Код отправлен' });

    } catch (e) {
        console.error('Ошибка отправки email:', e);
        res.status(500).json({ error: 'Ошибка отправки письма. Проверьте настройки SMTP.' });
    }
});

// Сброс пароля
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        const record = verificationCodes.get(email);
        if (!record || record.code !== code || Date.now() > record.expiresAt) {
            return res.status(400).json({ error: 'Неверный или просроченный код' });
        }

        // Ищем пользователя
        const userRecord = await admin.auth().getUserByEmail(email);
        
        // Обновляем пароль
        await admin.auth().updateUser(userRecord.uid, { password: newPassword });
        
        // Удаляем код
        verificationCodes.delete(email);

        res.json({ success: true, message: 'Пароль успешно изменен' });

    } catch (e) {
        console.error('Ошибка сброса пароля:', e);
        res.status(500).json({ error: 'Стучите админу: serviceAccountKey не настроен или проблема с Firebase' });
    }
});

// Смена почты (здесь отправляем на новую)
app.post('/api/auth/change-email', async (req, res) => {
    try {
        const { oldEmail, newEmail, code } = req.body;

        // В этом случае код мы отправляли на newEmail для проверки, что она принадлежит юзеру
        const record = verificationCodes.get(newEmail);
        if (!record || record.code !== code || Date.now() > record.expiresAt) {
            return res.status(400).json({ error: 'Неверный или просроченный код' });
        }

        const userRecord = await admin.auth().getUserByEmail(oldEmail);
        
        await admin.auth().updateUser(userRecord.uid, { email: newEmail });
        verificationCodes.delete(newEmail);

        res.json({ success: true, message: 'Почта успешно изменена' });
    } catch (e) {
        console.error('Ошибка смены почты:', e);
        if (e.code === 'auth/email-already-exists') {
             return res.status(400).json({ error: 'Этот email уже занят' });
        }
        res.status(500).json({ error: 'Ошибка Firebase (сервер не настроен должным образом)' });
    }
});
`;

code = code.replace(/import \{ fileURLToPath \} from 'url';/, "import { fileURLToPath } from 'url';\nimport fs from 'fs';");
code = code.replace(/app\.use\('\/api', rateLimit\(\{[\s\S]*?\}\)\);/, "$&\n" + authCode);

fs.writeFileSync('server.js', code);
