import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
    CORS_ORIGIN,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    MAX_BODY_BYTES
} from './src/config.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({
    limit: MAX_BODY_BYTES,
    strict: true
}));

app.use('/api', rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED'
    }
}));
        app.use('/api/custom-auth', rateLimit({
            windowMs: RATE_LIMIT_WINDOW_MS,
            max: RATE_LIMIT_MAX,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                success: false,
                error: 'Too many requests',
                code: 'RATE_LIMITED'
            }
        }));

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
app.post('/api/custom-auth/send-code', async (req, res) => {
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
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; background: #0f0f11; color: #fff; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,143,198,0.3); box-shadow: 0 10px 40px rgba(255,143,198,0.15);">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width: 48px; height: 48px; margin-bottom: 10px;">
                    <h2 style="color: #fff; font-size: 24px; margin-top: 0; margin-bottom: 25px; font-weight: 800; letter-spacing: 0.5px;">Авторизация COWIO</h2>
                    <p style="font-size: 15px; color: #aaa; margin-bottom: 15px; text-align: left;">Здравствуйте!</p>
                    <p style="font-size: 15px; color: #aaa; margin-bottom: 30px; text-align: left; line-height: 1.6;">Вы сделали запрос на получение кода подтверждения. Пожалуйста, введите приведенный ниже секретный код в приложении для подтверждения вашего действия.</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                        <tr>
                            ${code.split('').map(digit => `
                            <td style="padding: 0 4px;">
                                <div style="display: block; width: 44px; height: 50px; line-height: 50px; font-size: 26px; font-family: monospace; font-weight: 800; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; text-align: center; text-shadow: 0 0 10px rgba(255,255,255,0.3);">
                                    ${digit}
                                </div>
                            </td>
                            `).join('')}
                        </tr>
                    </table>
                    
                    <div style="font-size: 13px; color: #666; margin-top: 40px; text-align: left; line-height: 1.6; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <strong style="color: #888;">Важная информация:</strong><br><br>
                        • Этот код действителен в течение 10 минут.<br>
                        • Никому не передавайте этот код. Наши сотрудники никогда не попросят вас назвать его.<br>
                        • Если вы не запрашивали отправку кода, возможно, кто-то другой по ошибке ввел ваш email. Просто проигнорируйте и удалите это письмо.
                    </div>
                </div>
            `
        };

        if (!process.env.SMTP_USER || process.env.SMTP_USER === 'ваша_почта@gmail.com') {
            console.log(`[COWIO MOCK EMAIL] To: ${email}, Verification Code: ${code}`);
            return res.json({ success: true, message: 'Код отправлен в консоль (тестовый режим)' });
        }
        await mailTransporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Код отправлен' });

    } catch (e) {
        console.error('Ошибка отправки email:', e);
        res.status(500).json({ error: 'Ошибка отправки письма. Проверьте настройки SMTP.' });
    }
});

// Сброс пароля
app.post('/api/custom-auth/reset-password', async (req, res) => {
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
app.post('/api/custom-auth/change-email', async (req, res) => {
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


// API temporary disabled due to missing files in repo
app.get('/api/resolve-media', (req, res) => {
    res.status(500).json({ error: 'Backend media resolver not found' });
});

const publicPath = __dirname;
app.use(express.static(publicPath, { index: false })); // avoid index.html auto serving first if we want specific rules, or just allow it
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.use((err, req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        });
    }
    return next(err);
});

const finalPort = 3000;
app.listen(finalPort, '0.0.0.0', () => {
    console.log(`[COWIO] Server listening on http://0.0.0.0:${finalPort}`);
});
