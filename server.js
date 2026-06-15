import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
    CORS_ORIGIN,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    MAX_BODY_BYTES
} from './src/config.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Vercel, rewrites can strip the original path before Express routing.
if (process.env.VERCEL === '1') {
    app.use((req, _res, next) => {
        const raw =
            req.headers['x-vercel-original-url'] ||
            req.headers['x-original-url'] ||
            req.headers['x-forwarded-uri'] ||
            req.headers['x-invoke-path'];
        if (typeof raw === 'string' && raw.length > 0) {
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                const u = new URL(raw);
                req.url = u.pathname + u.search;
            } else {
                req.url = raw.startsWith('/') ? raw : `/${raw}`;
            }
        }
        next();
    });
}

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
import { registerPremiumRoutes } from './src/routes/premium.js';

// ----------------------------------------------------
// НАСТРОЙКА FIREBASE ADMIN И ПОЧТЫ (ДЛЯ СБРОСА ПАРОЛЯ)
// ----------------------------------------------------
try {
    // Внимание для создателя: чтобы это заработало, нужно поместить файл serviceAccountKey.json в корень проекта.
    // Если его нет, firebase-admin не запустится, но сервер не упадет (будет ошибка при попытке сброса).
    if (fs.existsSync('./serviceAccountKey.json')) {
        const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com'
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

// Проверка 6-значного кода (регистрация, сброс пароля и т.д.)
app.post('/api/custom-auth/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

        const record = verificationCodes.get(email);
        if (!record || record.code !== String(code).trim() || Date.now() > record.expiresAt) {
            return res.status(400).json({ error: 'Неверный или просроченный код' });
        }

        res.json({ success: true, message: 'Код подтверждён' });
    } catch (e) {
        console.error('Ошибка проверки кода:', e);
        res.status(500).json({ error: 'Ошибка проверки кода' });
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

registerPremiumRoutes(app, admin);

const guideAiCache = new Map();
const GUIDE_AI_CACHE_TTL_MS = 5 * 60 * 1000;
const GUIDE_AI_TIMEOUT_MS = Number(process.env.GUIDE_AI_TIMEOUT_MS || 6500);
const GUIDE_AI_MODEL = process.env.GROQ_AI_MODEL || "llama-3.1-8b-instant";
const geminiKey = process.env.GEMINI_API_KEY || "AIzaSyBx-rT_JZolf1jHh0bKN5P7c4rrgq9BQGE";
const geminiAi = geminiKey ? new GoogleGenAI({ 
    apiKey: geminiKey,
    httpOptions: {
        headers: {
            'User-Agent': 'aistudio-build'
        }
    }
}) : null;

// Diagnostics: check key on startup
if (geminiKey.startsWith('AIzaSyBx-rT_')) {
    console.warn("[Diagnostics] Using default fallback Gemini API key. If hitting rate limits or 404s, please configure a custom GEMINI_API_KEY in Vercel.");
} else if (geminiKey) {
    console.log("[Diagnostics] Custom Gemini API key is configured.");
} else {
    console.warn("[Diagnostics] Gemini API key is MISSING.");
}

function normalizeGuideText(text = "") {
    return String(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s@_-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildGuideFallback(query = "", docs = "") {
    const qLower = query.toLowerCase().trim();
    const isGreetingOrChat = ["как дела", "привет", "здравствуй", "ты кто", "настроение", "как жизнь", "расскажи о себе", "как ты", "что нового", "добрый день", "доброе утро"].some(s => qLower.includes(s));
    
    if (isGreetingOrChat) {
        return "У меня всё отлично! (Правда, мой нейросетевой мозг сейчас чуть-чуть перегружен от большого количества запросов). Если у тебя есть вопросы по сайту, напиши их, и я постараюсь помочь. Или мы можем просто пообщаться, а также ты можешь посмотреть видео и послушать музыку с друзьями в комнатах!";
    }

    const source = String(docs || "");
    const tokens = normalizeGuideText(query)
        .split(" ")
        .filter((word) => word.length > 2)
        .slice(0, 16);
    const entries = [];
    const entryRe = /В:\s*([^\n]+)\nО:\s*([\s\S]*?)(?=\nВ:|\n\nРаздел|$)/g;
    let match;

    while ((match = entryRe.exec(source))) {
        entries.push({ q: match[1].trim(), a: match[2].trim() });
    }

    let best = null;
    for (const entry of entries) {
        const haystack = normalizeGuideText(`${entry.q} ${entry.a}`);
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        if (!best || score > best.score) best = { ...entry, score };
    }

    if (best && best.score > 0) {
        return `Не могу подключиться к нейросети из-за лимита обращений, но вот что я нашел в базе данных сайта:\n${best.a}`;
    }

    return "Сложный вопрос. Мой ИИ-модуль сейчас перегружен запросами, поэтому я работаю в базовом режиме. Лучше всего открыть поддержку и задать вопрос там!";
}

function buildGuidePrompt(query, docs) {
    return [
        "Ты дружелюбный, общительный и жизнерадостный ИИ-ассистент платформы COWIO.",
        "Для ответа на специфичные вопросы об устройстве сайта используй базу знаний COWIO ниже.",
        "НО если пользователь просто общается, здоровается (привет, как дела, настроение, что делаешь), отвечает на твои вопросы или говорит на общие темы - поддерживай живой и интересный диалог! Отвечай по-человечески, шути, интересуйся мнением пользователя, предлагай провести время с друзьями, послушать музыку или включить видео в комнатах COWIO.",
        "Не ограничивай себя справочником. Будь открытым ИИ, с которым приятно болтать.",
        "Не будь сухим роботом, не говори 'возможно/похоже', общайся уверенно, лаконично и приветливо.",
        "Если пользователь задает технический вопрос, на который нет ответа в базе, посоветуй обратиться в поддержку.",
        "",
        `База знаний:\n${docs}`,
        "",
        `Ввод пользователя: ${query}`,
    ].join("\n");
}

async function withTimeout(taskFactory, timeoutMs = GUIDE_AI_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await taskFactory(controller.signal);
    } finally {
        clearTimeout(timer);
    }
}

async function askGroq(prompt) {
    if (!process.env.GROQ_API_KEY) return "";
    return withTimeout(async (signal) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            signal,
            body: JSON.stringify({
                model: GUIDE_AI_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 420,
            }),
        });

        if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);
        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() || "";
    });
}

async function askGemini(prompt) {
    if (!geminiAi) return "";
    const response = await withTimeout(() =>
        geminiAi.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
        }),
    );
    return response?.text?.trim() || "";
}

app.post('/api/ask-guide-ai', async (req, res) => {
    const query = String(req.body?.query || "").trim().slice(0, 600);
    const docs = String(req.body?.docs || "").trim().slice(0, 20000);
    const fallback = buildGuideFallback(query, docs);

    try {
        if (!query) {
            return res.json({ success: true, answer: "Напишите вопрос, и я подберу ответ по справочнику COWIO.", source: "fallback" });
        }

        const cacheKey = `${normalizeGuideText(query)}:${docs.length}`;
        const cached = guideAiCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < GUIDE_AI_CACHE_TTL_MS) {
            return res.json({ success: true, answer: cached.answer, source: cached.source, cached: true });
        }

        const prompt = buildGuidePrompt(query, docs);
        let answer = "";
        let source = "fallback";

        try {
            console.log(`[Diagnostics] Attempting Groq for question: "${query}"`);
            answer = await askGroq(prompt);
            source = answer ? "groq" : source;
        } catch (e) {
            console.warn("[Guide AI] Groq fallback:", e.message || e);
        }

        if (!answer) {
            try {
                console.log(`[Diagnostics] Attempting Gemini for question: "${query}"`);
                answer = await askGemini(prompt);
                source = answer ? "gemini" : source;
            } catch (e) {
                console.error("[Guide AI] Gemini fallback explicitly failed in askGemini:", e);
                // Also stringify error if it's an object to capture code/message
                if (e.status) console.error("Gemini Error Status:", e.status);
            }
        }

        answer = answer || fallback;
        guideAiCache.set(cacheKey, { answer, source, ts: Date.now() });
        res.json({ success: true, answer, source });
    } catch (e) {
        console.warn("[Guide AI] Safe fallback:", e.message || e);
        res.json({ success: true, answer: fallback, source: "fallback" });
    }
});

// Chat widget removed

app.post('/api/library/analyze-preview', async (req, res) => {
    try {
        const { imageUrl, title, description } = req.body;
        if (!imageUrl || !geminiAi) {
            return res.status(400).json({ success: false, error: "No image or no API key" });
        }

        // Fetch image as base64
        const imgRes = await fetch(imageUrl);
        if(!imgRes.ok) throw new Error("Image fetch failed");
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

        const prompt = `Ты - ИИ ассистент, анализирующий превью видеоролика для социальной платформы. Твоя задача: перечислить людей (известных личностей, блогеров, персонажей), которых ты видишь на картинке. Если людей нет или они неизвестны, ответь "Никто". Название видео: "${title}". Описание: "${description}". ВАЖНО: Отвечай строго только именами через запятую, без лишних слов, мыслей или описаний.`;

        const response = await geminiAi.models.generateContent({
            model: "gemini-3.5-flash",
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType } },
                    { text: prompt }
                ]
            }
        });

        res.json({ success: true, people: response.text.trim() });
    } catch (e) {
        console.error("Gemini Preview Analysis Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/library/fetch-metadata', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });

        let title = "Без названия";
        let description = "";

        try {
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    title = data.title;
                    description = data.author_name || ""; 
                }
            } else {
                const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }});
                if (fetchRes.ok) {
                    const html = await fetchRes.text();
                    
                    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
                    if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

                    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
                    if (descMatch && descMatch[1]) description = descMatch[1].trim();
                }
            }
        } catch(e) {
            console.error("Fetch metadata error:", e);
        }

        if (geminiAi) {
            try {
                const prompt = `Ты - креативный ИИ-копирайтер. Составь красивое, привлекающее внимание зрителя описание для видеоролика под названием "${title}". Оригинальное описание (если есть): "${description}". Напиши 1-2 живых предложения, используй подходящие эмодзи и объясни почему это стоит посмотреть. Не пиши ничего лишнего, только само описание.`;
                const aiDescResponse = await geminiAi.models.generateContent({
                    model: "gemini-3.5-flash",
                    contents: prompt
                });
                if (aiDescResponse.text) {
                    description = aiDescResponse.text.trim();
                }
            } catch (aiErr) {
                console.error("AI description failed", aiErr);
            }
        }

        res.json({ success: true, title, description });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
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

const finalPort = process.env.PORT || 3000;
if (process.env.VERCEL !== '1') {
    app.listen(finalPort, '0.0.0.0', () => {
        console.log(`[COWIO] Server listening on http://0.0.0.0:${finalPort}`);
    });
}
export default app;
