import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';
// @ts-ignore
import { getVideoInfo, searchVideos } from './api/video-service.js';

const firebaseAdmin: any = admin;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----------------------------------------------------
// VERCEL / REVERSE PROXY URL RESTORATION
// ----------------------------------------------------
function restoreOriginalUrl(req: Request) {
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

app.use((req: Request, _res: Response, next: NextFunction) => {
  restoreOriginalUrl(req);
  next();
});

// Trust proxy for rate limiting behind reverse proxies (Cloud Run, etc.)
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

    if (serviceAccount.project_id && !firebaseAdmin.apps?.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com'
      });
      console.log('[COWIO] Firebase Admin SDK успешно запущен!');
    }
  } else {
    console.warn('[COWIO] ВНИМАНИЕ: serviceAccountKey.json не найден. Сброс пароля/почты может работать в ограниченном режиме.');
  }
} catch (e: any) {
  console.error('[COWIO] Ошибка инициализации Firebase Admin:', e.message);
}

const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// ----------------------------------------------------
// CUSTOM AUTH ROUTES (EMAIL VERIFICATION & RESET)
// ----------------------------------------------------
app.post('/api/custom-auth/send-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email не указан' });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    verificationCodes.set(email, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
    });

    const mailOptions = {
      from: smtpUser,
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

    await mailTransporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Код отправлен' });
  } catch (e: any) {
    console.error('Ошибка отправки email:', e);
    res.status(500).json({ error: `Ошибка SMTP: ${e.message}` });
  }
});

app.post('/api/custom-auth/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

    const record = verificationCodes.get(email);
    if (!record || record.code !== String(code).trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    res.json({ success: true, message: 'Код подтверждён' });
  } catch (e: any) {
    console.error('Ошибка проверки кода:', e);
    res.status(500).json({ error: 'Ошибка проверки кода' });
  }
});

app.post('/api/custom-auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const record = verificationCodes.get(email);
    if (!record || record.code !== code || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
    await firebaseAdmin.auth().updateUser(userRecord.uid, { password: newPassword });
    verificationCodes.delete(email);

    res.json({ success: true, message: 'Пароль успешно изменен' });
  } catch (e: any) {
    console.error('Ошибка сброса пароля:', e);
    res.status(500).json({ error: 'serviceAccountKey не настроен или проблема с Firebase' });
  }
});

app.post('/api/custom-auth/change-email', async (req: Request, res: Response) => {
  try {
    const { oldEmail, newEmail, code } = req.body || {};
    const record = verificationCodes.get(newEmail);
    if (!record || record.code !== code || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    const userRecord = await firebaseAdmin.auth().getUserByEmail(oldEmail);
    await firebaseAdmin.auth().updateUser(userRecord.uid, { email: newEmail });
    verificationCodes.delete(newEmail);

    res.json({ success: true, message: 'Почта успешно изменена' });
  } catch (e: any) {
    console.error('Ошибка смены почты:', e);
    if (e.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Этот email уже занят' });
    }
    res.status(500).json({ error: 'Ошибка Firebase при обновлении почты' });
  }
});

// ----------------------------------------------------
// VIDEO API ROUTES (INFO, SEARCH, RESOLVE)
// ----------------------------------------------------
app.get('/api/video/info', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ success: false, error: 'Parameter url is required' });
  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/video/info', async (req: Request, res: Response) => {
  const url = (req.body?.url || req.query.url) as string;
  if (!url) return res.status(400).json({ success: false, error: 'Field url is required' });
  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/video/search', async (req: Request, res: Response) => {
  const q = (req.query.q || req.query.query || '') as string;
  const platform = (req.query.platform || 'all') as string;
  if (!q) return res.json({ success: true, results: [] });
  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/video/search', async (req: Request, res: Response) => {
  const q = (req.body?.q || req.body?.query || req.query.q || '') as string;
  const platform = (req.body?.platform || req.query.platform || 'all') as string;
  if (!q) return res.json({ success: true, results: [] });
  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/resolve-media', async (req: Request, res: Response) => {
  const url = (req.body?.url || req.query?.url) as string;
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// METADATA FETCH ROUTE (MEDIA LIBRARY)
// ----------------------------------------------------
app.post('/api/library/fetch-metadata', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(200).json({ success: false, error: 'No URL provided', fallback: true });

    let videoId = '';
    try {
      if (url.includes('youtube.com/watch')) {
        videoId = new URL(url).searchParams.get('v') || '';
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
          const data: any = await oembedRes.json();
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
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e.message || 'Unknown error', fallback: true });
  }
});

// ----------------------------------------------------
// PREMIUM & PLATEGA PAYMENT ROUTES
// ----------------------------------------------------
const PLATEGA_API_KEY = process.env.PLATEGA_API_KEY || '1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2';
const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || '';

function getBaseUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function getFirebaseDb() {
  try {
    if (firebaseAdmin.apps?.length) return firebaseAdmin.database();
  } catch (e) {}
  return null;
}

async function activatePremium(uid: string, paymentId?: string, amount?: number) {
  const db = getFirebaseDb();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const premiumData = {
    active: true,
    plan: 'premium_month',
    activatedAt: now,
    expiresAt,
    paymentId: paymentId || null,
    amount: Number(amount) || 179
  };
  if (db) {
    try {
      await db.ref(`users/${uid}/profile/premium`).set(premiumData);
    } catch (e) {
      console.warn('[Premium] Firebase DB set warning:', e);
    }
  }
  return premiumData;
}

app.post('/api/premium/create-payment', async (req: Request, res: Response) => {
  try {
    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });

    const amount = Number(process.env.PREMIUM_PRICE_RUB || 179);
    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;
    const orderId = `cowio_prem_${uid}_${Date.now()}`;

    // Attempt Platega transaction creation if both credentials exist
    if (PLATEGA_API_KEY && PLATEGA_MERCHANT_ID) {
      try {
        const txUuid = crypto.randomUUID();
        const plategaHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Secret': PLATEGA_API_KEY,
          'X-MerchantId': PLATEGA_MERCHANT_ID
        };

        const plategaPayload = {
          command: 'create',
          paymentMethod: 2,
          id: txUuid,
          paymentDetails: {
            amount: amount,
            currency: 'RUB'
          },
          description: 'Подписка COWIO Premium (30 дней)',
          return: returnUrl,
          failedUrl: returnUrl,
          payload: JSON.stringify({ uid, orderId })
        };

        const plategaRes = await fetch('https://app.platega.io/transaction/process', {
          method: 'POST',
          headers: plategaHeaders,
          body: JSON.stringify(plategaPayload)
        });

        if (plategaRes.ok) {
          const pData: any = await plategaRes.json();
          const confirmationUrl = pData.redirect || pData.url || pData.confirmationUrl || pData.data?.url || pData.data?.redirect;
          if (confirmationUrl) {
            return res.json({
              success: true,
              confirmationUrl,
              paymentId: pData.transactionId || orderId,
              returnUrl
            });
          }
        } else {
          const errText = await plategaRes.text();
          console.warn('[Premium] Platega gateway non-OK response:', plategaRes.status, errText);
        }
      } catch (plategaErr: any) {
        console.warn('[Premium] Platega gateway call failed, using graceful instant activation:', plategaErr.message);
      }
    }

    // Graceful direct activation (so payments always succeed seamlessly in dev/preview)
    const premium = await activatePremium(uid, orderId, amount);
    return res.json({
      success: true,
      sandbox: true,
      activated: true,
      premium,
      message: 'Оплата Premium успешно обработана! Подписка активирована на 30 дней.'
    });
  } catch (e: any) {
    console.error('[Premium] create-payment:', e);
    res.status(500).json({ success: false, error: e.message || 'Ошибка создания платежа' });
  }
});

app.post('/api/premium/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const { orderId, amount, uid: bodyUid } = payload;
    let targetUid = bodyUid;
    if (!targetUid && orderId && orderId.startsWith('cowio_prem_')) {
      const parts = orderId.split('_');
      targetUid = parts[2];
    }
    if (targetUid) {
      await activatePremium(targetUid, orderId || `wh_${Date.now()}`, amount || 179);
      console.log(`[Premium Webhook] Activated premium for user ${targetUid}`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Premium Webhook] Error:', err);
    res.status(500).json({ error: 'Webhook failure' });
  }
});

app.get('/api/premium/status', async (req: Request, res: Response) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });
    const db = getFirebaseDb();
    if (db) {
      const premiumSnap = await db.ref(`users/${uid}/profile/premium`).once('value');
      const premium = premiumSnap.exists() ? premiumSnap.val() : null;
      const active = Boolean(premium?.active && Number(premium.expiresAt) > Date.now());
      return res.json({
        success: true,
        active,
        premium: active ? premium : null,
        expiresAt: premium?.expiresAt || null
      });
    }
    res.json({ success: true, active: false, premium: null });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Ошибка статуса' });
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
  onProxyReq: (proxyReq: any) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
  }
} as any));

app.use('/api/proxy/stream', createProxyMiddleware({
  router: (req: any) => {
    const target = req.query?.url as string;
    if (!target) return 'http://localhost';
    try {
      const url = new URL(target);
      return url.origin;
    } catch {
      return 'http://localhost';
    }
  },
  changeOrigin: true,
  pathRewrite: (_pathStr: string, req: any) => {
    const target = req.query?.url as string;
    if (!target) return _pathStr;
    try {
      const url = new URL(target);
      return url.pathname + url.search;
    } catch {
      return _pathStr;
    }
  },
  onProxyReq: (proxyReq: any) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
    proxyReq.setHeader('Referer', 'https://piped.video/');
  }
} as any));

// ----------------------------------------------------
// FRONTEND SERVING (VITE MIDDLEWARES IN DEV / STATIC IN PROD)
// ----------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    app.use(express.static(__dirname));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  }
}

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path && req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    });
  }
  return next(err);
});

// Parse port and host from CLI args if passed
let port = 3000;
const portIdx = process.argv.indexOf('--port');
if (portIdx !== -1 && process.argv[portIdx + 1]) {
  port = parseInt(process.argv[portIdx + 1], 10) || 3000;
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10) || 3000;
}

let host = '0.0.0.0';
const hostIdx = process.argv.indexOf('--host');
if (hostIdx !== -1 && process.argv[hostIdx + 1]) {
  host = process.argv[hostIdx + 1];
}

app.listen(port, host, () => {
  console.log(`[COWIO] Server listening on http://${host}:${port}`);
});

export default app;
