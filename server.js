import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getVideoInfo, searchVideos } from './api/video-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----------------------------------------------------
// VERCEL / REVERSE PROXY URL RESTORATION
// ----------------------------------------------------
function restoreOriginalUrl(req) {
  const raw =
    req.headers['x-vercel-original-url'] ||
    req.headers['x-original-url'] ||
    req.headers['x-forwarded-uri'] ||
    req.headers['x-invoke-path'];
  if (typeof raw !== 'string' || !raw.length) return;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const u = new URL(raw);
    req.url = u.pathname + u.search;
  } else {
    req.url = raw.startsWith('/') ? raw : `/${raw}`;
  }
}

app.use((req, res, next) => {
  restoreOriginalUrl(req);
  next();
});

// Trust proxy for rate limiting behind reverse proxies (Cloud Run, Vercel, etc.)
app.set('trust proxy', 1);

// ----------------------------------------------------
// CONFIG & MIDDLEWARE
// ----------------------------------------------------
const RATE_LIMIT_MAX = 1000;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_BODY_BYTES = '10mb';

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-webhook-key', 'x-premium-admin-secret']
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

// ----------------------------------------------------
// FIREBASE ADMIN & NODEMAILER
// ----------------------------------------------------
let smtpUser = process.env.SMTP_USER || 'cowiosupport@gmail.com';
let smtpPass = process.env.SMTP_PASS || 'qbkeftvifbqyicyx';

try {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (serviceAccount.SMTP_USER) smtpUser = serviceAccount.SMTP_USER;
    if (serviceAccount.SMTP_PASS) smtpPass = serviceAccount.SMTP_PASS;
    if (serviceAccount.SMTp_USER) smtpUser = serviceAccount.SMTp_USER;

    if (serviceAccount.project_id) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com'
      });
      console.log('[COWIO] Firebase Admin SDK успешно запущен!');
    }
  } else {
    console.warn('[COWIO] ВНИМАНИЕ: serviceAccountKey.json не найден. Сброс пароля/почты может работать в ограниченном режиме.');
  }
} catch (e) {
  console.error('[COWIO] Ошибка инициализации Firebase Admin:', e.message);
}

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'cowio_super_secret_auth_key_2026';

function generateVerificationToken(email, code, expiresAt) {
  const normEmail = String(email).trim().toLowerCase();
  const data = `${normEmail}:${code}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return `${expiresAt}:${sig}`;
}

function verifyVerificationToken(email, code, token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const normEmail = String(email).trim().toLowerCase();
  const data = `${normEmail}:${String(code).trim()}:${expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return sig === expectedSig;
}

function getMailTransporter(useSsl = true) {
  const user = (
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_EMAIL ||
    smtpUser ||
    'cowiosupport@gmail.com'
  ).trim();

  let pass = (
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.GMAIL_PASS ||
    smtpPass ||
    'qbkeftvifbqyicyx'
  ).trim();
  pass = pass.replace(/\s+/g, '');

  const customHost = (process.env.SMTP_HOST || '').trim();
  const isGmail = (!customHost && user.includes('@gmail.com')) || (customHost && customHost.includes('gmail.com'));

  // If using Gmail with no custom non-Google host, 'service: gmail' is nodemailer's official recommendation
  if (isGmail && !customHost) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
      }),
      user
    };
  }

  const host = customHost || 'smtp.gmail.com';
  const port = useSsl ? 465 : 587;

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: useSsl,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    }),
    user
  };
}

const verificationCodes = new Map();

// ----------------------------------------------------
// CUSTOM AUTH ROUTES (EMAIL VERIFICATION & RESET)
// ----------------------------------------------------
app.post('/api/custom-auth/send-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ success: false, error: 'Email не указан' });

    const normalizedEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    verificationCodes.set(normalizedEmail, {
      code,
      expiresAt
    });

    const token = generateVerificationToken(normalizedEmail, code, expiresAt);

    console.log(`[COWIO Auth] 🔑 Generated verification code for ${normalizedEmail}: ${code}`);

    const htmlContent = `
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
          • Если вы не запрашивали отправку кода, просто проигнорируйте это письмо.
        </div>
      </div>
    `;

    let emailSent = false;
    let lastError = null;

    // Attempt 1: Direct SSL (Port 465)
    try {
      const { transporter, user } = getMailTransporter(true);
      await transporter.sendMail({
        from: `"COWIO" <${user}>`,
        to: normalizedEmail,
        subject: 'Код подтверждения COWIO',
        html: htmlContent
      });
      emailSent = true;
      console.log(`[COWIO Auth] ✉️ Code sent successfully via SSL (port 465) to ${normalizedEmail}`);
    } catch (err1) {
      console.warn(`[COWIO Auth] Port 465 failed: ${err1.message}. Retrying via STARTTLS (port 587)...`);
      lastError = err1;

      // Attempt 2: STARTTLS (Port 587)
      try {
        const { transporter, user } = getMailTransporter(false);
        await transporter.sendMail({
          from: `"COWIO" <${user}>`,
          to: normalizedEmail,
          subject: 'Код подтверждения COWIO',
          html: htmlContent
        });
        emailSent = true;
        console.log(`[COWIO Auth] ✉️ Code sent successfully via STARTTLS (port 587) to ${normalizedEmail}`);
      } catch (err2) {
        console.error(`[COWIO Auth] Port 587 also failed: ${err2.message}`);
        lastError = err2;
      }
    }

    if (!emailSent) {
      console.warn(`[COWIO Auth] SMTP was unreachable or rejected credentials. Code logged to console: ${code}`);
      return res.json({
        success: true,
        message: 'Код сгенерирован (проверьте почту или логи)',
        token,
        code
      });
    }

    return res.json({ success: true, message: 'Код успешно отправлен на почту', token });
  } catch (e) {
    console.error('Ошибка в /api/custom-auth/send-code:', e);
    res.status(500).json({ success: false, error: `Ошибка отправки: ${e.message}` });
  }
});

app.post('/api/custom-auth/verify-code', async (req, res) => {
  try {
    const { email, code, token } = req.body || {};
    if (!email || !code) return res.status(400).json({ success: false, error: 'Email и код обязательны' });

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
    const record = verificationCodes.get(normalizedEmail);
    const isMemoryValid = record && record.code === cleanCode && Date.now() <= record.expiresAt;

    if (!isTokenValid && !isMemoryValid) {
      return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
    }

    // Code verified
    verificationCodes.delete(normalizedEmail);
    res.json({ success: true, message: 'Код подтверждён' });
  } catch (e) {
    console.error('Ошибка проверки кода:', e);
    res.status(500).json({ success: false, error: 'Ошибка проверки кода' });
  }
});

app.post('/api/custom-auth/reset-password', async (req, res) => {
  try {
    const { email, code, token, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
    const record = verificationCodes.get(normalizedEmail);
    const isMemoryValid = record && record.code === cleanCode && Date.now() <= record.expiresAt;

    if (!isTokenValid && !isMemoryValid) {
      return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
    }

    if (admin.apps?.length) {
      const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
    }
    verificationCodes.delete(normalizedEmail);

    res.json({ success: true, message: 'Пароль успешно изменен' });
  } catch (e) {
    console.error('Ошибка сброса пароля:', e);
    res.status(500).json({ success: false, error: e.message || 'Ошибка сброса пароля' });
  }
});

app.post('/api/custom-auth/change-email', async (req, res) => {
  try {
    const { oldEmail, newEmail, code, token } = req.body || {};
    if (!oldEmail || !newEmail || !code) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const isTokenValid = verifyVerificationToken(normalizedNewEmail, cleanCode, token);
    const record = verificationCodes.get(normalizedNewEmail);
    const isMemoryValid = record && record.code === cleanCode && Date.now() <= record.expiresAt;

    if (!isTokenValid && !isMemoryValid) {
      return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
    }

    if (admin.apps?.length) {
      const userRecord = await admin.auth().getUserByEmail(oldEmail.trim().toLowerCase());
      await admin.auth().updateUser(userRecord.uid, { email: normalizedNewEmail });
    }
    verificationCodes.delete(normalizedNewEmail);

    res.json({ success: true, message: 'Почта успешно изменена' });
  } catch (e) {
    console.error('Ошибка смены почты:', e);
    if (e.code === 'auth/email-already-exists') {
      return res.status(400).json({ success: false, error: 'Этот email уже занят' });
    }
    res.status(500).json({ success: false, error: e.message || 'Ошибка обновления почты' });
  }
});

// ----------------------------------------------------
// VIDEO API ROUTES (INFO, SEARCH, RESOLVE)
// ----------------------------------------------------
app.get('/api/video/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ success: false, error: 'Parameter url is required' });
  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/video/info', async (req, res) => {
  const url = req.body?.url || req.query.url;
  if (!url) return res.status(400).json({ success: false, error: 'Field url is required' });
  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/video/search', async (req, res) => {
  const q = req.query.q || req.query.query || '';
  const platform = req.query.platform || 'all';
  if (!q) return res.json({ success: true, results: [] });
  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/video/search', async (req, res) => {
  const q = req.body?.q || req.body?.query || req.query.q || '';
  const platform = req.body?.platform || req.query.platform || 'all';
  if (!q) return res.json({ success: true, results: [] });
  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/resolve-media', async (req, res) => {
  const url = req.body?.url || req.query?.url;
  if (!url) return res.status(400).json({ success: false, error: 'url required' });
  try {
    const info = await getVideoInfo(url);
    if (!info || !info.success) {
      return res.status(400).json({ success: false, error: 'Could not resolve media' });
    }
    return res.json({
      success: true,
      source: info.url || url,
      title: info.title || '',
      duration: 0,
      thumbnail: info.thumbnail || '',
      platform: info.platform || 'unknown',
      isHls: /\.m3u8/i.test(info.url || url),
      ext: info.platform || '',
      resolvedAt: Date.now()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// METADATA FETCH ROUTE (MEDIA LIBRARY)
// ----------------------------------------------------
app.post('/api/library/fetch-metadata', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(200).json({ success: false, error: 'No URL provided', fallback: true });

    let videoId = '';
    try {
      if (url.includes('youtube.com/watch')) {
        videoId = new URL(url).searchParams.get('v');
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1].split('?')[0];
      }
    } catch (e) {}

    let title = 'Без названия';
    let description = '';
    let authorName = '';
    let authorAvatar = '';

    if (videoId) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { signal: AbortSignal.timeout(4000) });
        if (oembedRes.ok) {
          const data = await oembedRes.json();
          title = data.title || title;
          authorName = data.author_name || authorName;
          authorAvatar = data.thumbnail_url || authorAvatar;
        }
      } catch (e) {}

      try {
        const fetchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          signal: AbortSignal.timeout(4000)
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
          if (descMatch && descMatch[1]) description = descMatch[1].trim();
          if (!title || title === 'Без названия') {
            const titleMatch = html.match(/<meta\s+title="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
            if (titleMatch && titleMatch[1]) title = titleMatch[1].replace('- YouTube', '').trim();
          }
        }
      } catch (e) {}
    } else if (url.includes('rutube.ru')) {
      try {
        const info = await getVideoInfo(url);
        if (info && info.success) {
          title = info.title || title;
          authorName = info.author || authorName;
          authorAvatar = info.authorAvatar || authorAvatar;
        }
      } catch (e) {}
    }

    if (description) {
      description = description.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (description.includes('Enjoy the videos and music you love') || description.includes('YouTube')) {
        description = '';
      }
    }

    return res.status(200).json({ success: true, title, description, authorName, authorAvatar });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message || 'Unknown error', fallback: true });
  }
});

// ----------------------------------------------------
// EMOJI & STICKER PROXY FOR FAST ACCESS WITHOUT VPN
// ----------------------------------------------------
const emojiCache = new Map();
const fallbackWebpBuffer = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');

const EMOJI_ALIASES_MAP = {
  'objects/pen.webp': 'Objects/Pencil.webp',
  'symbols/back arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/back%20arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/counterclockwise arrows button.webp': 'Symbols/Currency Exchange.webp',
  'symbols/counterclockwise%20arrows%20button.webp': 'Symbols/Currency Exchange.webp',
  'objects/wastebasket.webp': 'Symbols/Cross Mark.webp',
  'objects/paperclip.webp': 'Objects/Memo.webp',
  'objects/envelope.webp': 'Objects/Incoming Envelope.webp',
  'objects/package.webp': 'Objects/Toolbox.webp'
};

app.get('/api/emoji-proxy', async (req, res) => {
  try {
    let rawPath = ((req.query.path || req.query.url || '') + '').trim();
    if (!rawPath) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fallbackWebpBuffer);
    }

    let emojiPath = rawPath
      .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
      .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
      .replace(/^\/+/, '');

    try {
      emojiPath = decodeURIComponent(emojiPath);
    } catch (e) {}

    const lowerKey = emojiPath.toLowerCase();
    if (EMOJI_ALIASES_MAP[lowerKey]) {
      emojiPath = EMOJI_ALIASES_MAP[lowerKey];
    }

    const encodedPath = encodeURI(emojiPath);
    const cacheKey = emojiPath;
    const cached = emojiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 7 * 24 * 3600 * 1000)) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(cached.buffer);
    }

    const mirrors = [
      `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://testingcf.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://fastly.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`,
      `https://cdn.statically.io/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`
    ];

    try {
      const fetchWinner = await Promise.any(
        mirrors.map(async (mirror) => {
          const fetchRes = await fetch(mirror, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!fetchRes.ok) throw new Error('Not ok: ' + fetchRes.status);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/webp';
          return { buffer: Buffer.from(arrayBuffer), contentType };
        })
      );

      if (emojiCache.size > 2000) {
        const firstKey = emojiCache.keys().next().value;
        if (firstKey) emojiCache.delete(firstKey);
      }
      emojiCache.set(cacheKey, { buffer: fetchWinner.buffer, contentType: fetchWinner.contentType, timestamp: Date.now() });

      res.setHeader('Content-Type', fetchWinner.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(fetchWinner.buffer);
    } catch (allFailed) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fallbackWebpBuffer);
    }
  } catch (err) {
    res.setHeader('Content-Type', 'image/webp');
    return res.status(200).send(fallbackWebpBuffer);
  }
});

// ----------------------------------------------------
// PREMIUM & PLATEGA PAYMENT ROUTES
// ----------------------------------------------------
const PLATEGA_API_KEY = process.env.PLATEGA_API_KEY || '1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2';
const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || 'f5c52bf0-56b2-485d-b5b1-b0f44cb34b8e';

function plategaConfigured() {
  return Boolean(PLATEGA_API_KEY && PLATEGA_MERCHANT_ID);
}

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function getFirebaseDb() {
  try {
    if (admin.apps?.length) return admin.database();
  } catch (e) {}
  return null;
}

async function activatePremium(uid, paymentId, amount, days) {
  const db = getFirebaseDb();
  const now = Date.now();
  let durationDays = Number(days) || 30;
  if (!days) {
    if (amount >= 800) durationDays = 180;
    else if (amount >= 400) durationDays = 90;
  }
  const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;
  const premiumData = {
    active: true,
    plan: durationDays >= 180 ? 'premium_6months' : durationDays >= 90 ? 'premium_3months' : 'premium_month',
    activatedAt: now,
    expiresAt,
    paymentId: paymentId || null,
    amount: Number(amount) || 179
  };
  if (db) {
    await db.ref(`users/${uid}/profile/premium`).set(premiumData);
  }
  return premiumData;
}

app.post('/api/premium/create-payment', async (req, res) => {
  try {
    const { uid, userName, email } = req.body || {};
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });

    const amount = Number(req.body?.amount) || Number(process.env.PREMIUM_PRICE_RUB || 179);
    const days = Number(req.body?.days) || (amount >= 800 ? 180 : amount >= 400 ? 90 : 30);
    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;
    const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(uid)}`;
    const orderId = `cowio_prem_${uid}_${Date.now()}`;
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

    if (!PLATEGA_API_KEY || !PLATEGA_MERCHANT_ID) {
      return res.status(500).json({ success: false, error: 'Шлюз Platega не настроен на сервере' });
    }

    const plategaHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Secret': PLATEGA_API_KEY,
      'X-MerchantId': PLATEGA_MERCHANT_ID
    };

    const plategaPayload = {
      paymentMethod: 2,
      paymentDetails: {
        amount: amount,
        currency: 'RUB'
      },
      description: `Подписка COWIO Premium (${days} дней)`,
      return: returnUrl,
      failedUrl: failedUrl,
      payload: JSON.stringify({ uid, orderId, days, amount }),
      metadata: {
        userId: String(uid),
        userName: String(userName || email || 'User'),
        clientIp: clientIp
      }
    };

    const plategaRes = await fetch('https://app.platega.io/transaction/process', {
      method: 'POST',
      headers: plategaHeaders,
      body: JSON.stringify(plategaPayload)
    });

    if (!plategaRes.ok) {
      const errText = await plategaRes.text();
      console.error('[Premium] Platega gateway non-OK response:', plategaRes.status, errText);
      let errMsg = 'Ошибка платежного шлюза Platega';
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errMsg = `Platega: ${parsed.message}`;
      } catch {}
      return res.status(plategaRes.status || 400).json({ success: false, error: errMsg });
    }

    const pData = await plategaRes.json();
    const confirmationUrl = pData.redirect || pData.url || pData.confirmationUrl;
    if (!confirmationUrl) {
      console.error('[Premium] Platega returned no redirect URL:', pData);
      return res.status(502).json({ success: false, error: 'Шлюз не предоставил ссылку для оплаты' });
    }

    return res.json({
      success: true,
      confirmationUrl,
      paymentId: pData.transactionId || pData.id || orderId,
      returnUrl
    });
  } catch (e) {
    console.error('[Premium] create-payment error:', e);
    res.status(500).json({ success: false, error: e.message || 'Ошибка создания платежа' });
  }
});

app.post('/api/premium/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Premium Webhook] Received callback from Platega:', JSON.stringify(payload));
    const status = String(payload.status || '').toUpperCase();
    const txId = payload.id || payload.transactionId || '';

    if (status === 'CONFIRMED' || status === 'SUCCESS' || status === 'PAID') {
      let targetUid = payload.uid || payload.userId || '';
      let orderId = payload.orderId || payload.externalId || txId;
      const amount = Number(payload.paymentDetails?.amount) || Number(payload.amount) || 179;

      if (!targetUid && payload.payload) {
        try {
          const parsed = typeof payload.payload === 'string' ? JSON.parse(payload.payload) : payload.payload;
          if (parsed.uid) targetUid = parsed.uid;
          if (parsed.orderId) orderId = parsed.orderId;
        } catch {}
      }

      if (!targetUid && payload.metadata?.userId) {
        targetUid = payload.metadata.userId;
      }

      if (!targetUid && orderId && orderId.startsWith('cowio_prem_')) {
        const parts = orderId.split('_');
        targetUid = parts[2];
      }

      if (targetUid) {
        await activatePremium(targetUid, txId || orderId, amount);
        console.log(`[Premium Webhook] Activated premium for user ${targetUid} via Platega webhook`);
      }
    }
    res.json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    console.error('[Premium Webhook] Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/premium/status', async (req, res) => {
  try {
    const uid = req.query.uid || '';
    const paymentId = req.query.paymentId || '';
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });

    const db = getFirebaseDb();
    let currentPremium = null;
    if (db) {
      const premiumSnap = await db.ref(`users/${uid}/profile/premium`).once('value');
      if (premiumSnap.exists()) currentPremium = premiumSnap.val();
    }

    let isActive = Boolean(currentPremium?.active && Number(currentPremium.expiresAt) > Date.now());

    // If not active yet, and paymentId is provided, query Platega directly
    if (!isActive && paymentId && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const pRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(paymentId)}`, {
          headers: {
            'X-MerchantId': PLATEGA_MERCHANT_ID,
            'X-Secret': PLATEGA_API_KEY
          }
        });
        if (pRes.ok) {
          const txData = await pRes.json();
          const txStatus = String(txData.status || '').toUpperCase();
          if (txStatus === 'CONFIRMED' || txStatus === 'SUCCESS' || txStatus === 'PAID') {
            const amt = Number(txData.paymentDetails?.amount) || 179;
            currentPremium = await activatePremium(uid, paymentId, amt);
            isActive = true;
            console.log(`[Premium Status] Verified transaction ${paymentId} with Platega -> Activated for ${uid}`);
          } else if (txStatus === 'PENDING') {
            return res.json({
              success: true,
              active: false,
              pending: true,
              message: 'Платёж ожидает подтверждения банком'
            });
          } else if (txStatus === 'CANCELED' || txStatus === 'EXPIRED' || txStatus === 'FAILED') {
            return res.json({
              success: true,
              active: false,
              canceled: true,
              message: 'Платёж отменён или истёк срок действия'
            });
          }
        }
      } catch (chkErr) {
        console.warn('[Premium Status] Check Platega tx error:', chkErr);
      }
    }

    return res.json({
      success: true,
      active: isActive,
      premium: isActive ? currentPremium : null,
      expiresAt: currentPremium?.expiresAt || null
    });
  } catch (e) {
    console.error('[Premium Status] error:', e);
    res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
  }
});

// ----------------------------------------------------
// PROXIES (YOUTUBE & HLS STREAM)
// ----------------------------------------------------
app.use('/api/proxy/yt', createProxyMiddleware({
  target: 'https://pipedapi.smnz.de',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy/yt': ''
  },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
  }
}));

app.use('/api/proxy/stream', createProxyMiddleware({
  router: (req) => {
    const target = req.query.url;
    if (!target) return 'http://localhost';
    try {
      const url = new URL(target);
      return url.origin;
    } catch {
      return 'http://localhost';
    }
  },
  changeOrigin: true,
  pathRewrite: (pathStr, req) => {
    const target = req.query.url;
    if (!target) return pathStr;
    try {
      const url = new URL(target);
      return url.pathname + url.search;
    } catch {
      return pathStr;
    }
  },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
    proxyReq.setHeader('Referer', 'https://piped.video/');
  }
}));

// ----------------------------------------------------
// STATIC FILES & SPA SERVING
// ----------------------------------------------------
const distPath = path.join(__dirname, 'dist');
const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

if (hasDist) {
  app.use(express.static(distPath, { index: false }));
}
app.use(express.static(__dirname, { index: false }));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const targetHtml = hasDist ? path.join(distPath, 'index.html') : path.join(__dirname, 'index.html');
  res.sendFile(targetHtml);
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (req.path && req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    });
  }
  return next(err);
});

const PORT = 3000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[COWIO] Server listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
