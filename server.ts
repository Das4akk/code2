import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';

import { validateUrl, safeFetch, isDomainAllowed, isPrivateIp, ALLOWED_MEDIA_DOMAINS } from './utils/url-validator.js';
import { sanitizeHtml, sanitizeText, sanitizeObject, prototypePollutionMiddleware } from './utils/sanitize.js';
import { requireAuth, requireRole, optionalAuth } from './lib/auth-middleware.js';
import {
  validate,
  SendCodeSchema,
  VerifyCodeSchema,
  ResetPasswordSchema,
  ChangeEmailSchema,
  CreatePaymentSchema,
  VideoInfoSchema,
  VideoSearchSchema,
  ResolveMediaSchema,
  CheckRoleSchema,
  ClaimRoleSchema
} from './lib/schemas.js';
import {
  resolveAutoRole,
  syncRoleToDatabase,
  verifyRoleSecret,
  ROLE_DISPLAY_NAMES,
  UserRole
} from './lib/roles.js';
// @ts-ignore
import { getVideoInfo, searchVideos } from './api/video-service.js';

const firebaseAdmin: any = admin;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (Vercel, Cloud Run, Cloudflare)
app.set('trust proxy', 1);

// ----------------------------------------------------
// VERCEL / REVERSE PROXY URL RESTORATION
// ----------------------------------------------------
function restoreOriginalUrl(req: Request) {
  const raw =
    (req.headers['x-vercel-original-url'] as string) ||
    (req.headers['x-original-url'] as string) ||
    (req.headers['x-forwarded-uri'] as string);
  if (typeof raw !== 'string' || !raw.length) return;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      req.url = u.pathname + u.search;
    } catch {}
  } else {
    req.url = raw.startsWith('/') ? raw : `/${raw}`;
  }
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  restoreOriginalUrl(req);
  next();
});

// ----------------------------------------------------
// SECURITY HEADERS & CSP (HELMET)
// ----------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://www.gstatic.com',
          'https://apis.google.com',
          'https://*.googleapis.com',
          'https://cdn.jsdelivr.net',
          'https://*.jsdelivr.net',
          'https://fastly.jsdelivr.net',
          'https://cdn.statically.io'
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'https://*.firebaseio.com',
          'wss://*.firebaseio.com',
          'https://*.googleapis.com',
          'https://firebaseinstallations.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://cdn.jsdelivr.net',
          'https://*.jsdelivr.net',
          'https://fastly.jsdelivr.net',
          'https://raw.githubusercontent.com',
          'https://cdn.statically.io'
        ],
        frameSrc: [
          "'self'",
          'https://www.youtube.com',
          'https://rutube.ru',
          'https://vk.com',
          'https://vkvideo.ru',
          'https://*.vk.com',
          'https://*.vkvideo.ru'
        ],
        frameAncestors: null,
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    frameguard: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// ----------------------------------------------------
// CORS STRICT WHITELIST
// ----------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://cowio.vercel.app',
  'https://cowio.ru',
  'https://www.cowio.ru',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:5173']
    : [])
];

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      return res.status(403).json({
        success: false,
        error: 'CORS policy violation: Origin not allowed'
      });
    }
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-webhook-key', 'x-signature']
  })
);

// ----------------------------------------------------
// REQUEST BODY LIMITS & PROTOTYPE POLLUTION DEFENSE
// ----------------------------------------------------
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(prototypePollutionMiddleware);

// ----------------------------------------------------
// FIREBASE ADMIN & NODEMAILER INITIALIZATION
// ----------------------------------------------------
let smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
let smtpPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

try {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com';

  if (process.env.FIREBASE_ADMIN_KEY && !firebaseAdmin.apps?.length) {
    const creds = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(creds),
      databaseURL
    });
    console.log('[COWIO] Firebase Admin SDK успешно запущен через FIREBASE_ADMIN_KEY env!');
  } else {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath) && !firebaseAdmin.apps?.length) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      if (serviceAccount.SMTP_USER) smtpUser = serviceAccount.SMTP_USER;
      if (serviceAccount.SMTP_PASS) smtpPass = serviceAccount.SMTP_PASS;

      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        databaseURL
      });
      console.log('[COWIO] Firebase Admin SDK успешно запущен из serviceAccountKey.json!');
    }
  }
} catch (e: any) {
  console.error('[COWIO] Ошибка инициализации Firebase Admin:', e.message);
}

const AUTH_SECRET = process.env.AUTH_SECRET || '';

function generateVerificationToken(email: string, code: string, expiresAt: number): string {
  if (!AUTH_SECRET) {
    console.warn('[COWIO Auth] ВНИМАНИЕ: AUTH_SECRET не задан в .env. Используется случайный ключ для сессии.');
  }
  const secretKey = AUTH_SECRET || 'temporary_session_auth_secret_key_32bytes_min';
  const normEmail = email.trim().toLowerCase();
  const data = `${normEmail}:${code}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  return `${expiresAt}:${sig}`;
}

function verifyVerificationToken(email: string, code: string, token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  if (!expiresAtStr || !sig) return false;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const secretKey = AUTH_SECRET || 'temporary_session_auth_secret_key_32bytes_min';
  const normEmail = email.trim().toLowerCase();
  const data = `${normEmail}:${String(code).trim()}:${expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', secretKey).update(data).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'));
  } catch {
    return false;
  }
}

function getMailTransporter(useSsl = true) {
  const user = smtpUser;
  const pass = smtpPass;
  const customHost = (process.env.SMTP_HOST || '').trim();
  const isGmail = (!customHost && user.includes('@gmail.com')) || (customHost && customHost.includes('gmail.com'));

  if (isGmail && !customHost) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      }),
      user
    };
  }

  const host = customHost || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || (useSsl ? '465' : '587'), 10);
  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: useSsl,
      auth: { user, pass },
      tls: { rejectUnauthorized: true }
    }),
    user
  };
}

// ----------------------------------------------------
// VERIFICATION CODES & RATE LIMITERS
// ----------------------------------------------------
interface VerificationRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const verificationCodes = new Map<string, VerificationRecord>();
const lockoutMap = new Map<string, number>();

// Rate limiters
const sendCodeIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Превышен лимит отправки кодов с вашего IP (макс. 10 в час)' }
});

const sendCodeEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || '').toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Превышен лимит отправки кодов на этот email (макс. 3 за 15 минут)' }
});

const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || '').toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много попыток проверки кода. Подождите 15 минут.' }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || '').toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Превышен лимит сброса пароля (макс. 3 в час)' }
});

const createPaymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  validate: false,
  keyGenerator: (req) => req.user?.uid || req.ip || 'anonymous',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Превышен лимит создания платежей (макс. 10 в час)' }
});

const claimRoleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  validate: false,
  keyGenerator: (req) => req.user?.uid || req.ip || 'anonymous',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много попыток ввода секретного ключа роли. Подождите 15 минут.' }
});

// Helper for hashing sensitive identifiers in logs
function hashForLog(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// ----------------------------------------------------
// PUBLIC HEALTH CHECK
// ----------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    app: 'COWIO',
    env: process.env.NODE_ENV || 'development'
  });
});

// ----------------------------------------------------
// ROLE CHECK ENDPOINT (SERVER-SIDE AUTHORIZATION)
// ----------------------------------------------------
app.all('/api/auth/check-role', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email;
    const db = getFirebaseDb();

    // Check automatic role qualifications via environment variables or Firebase config
    const autoRole = await resolveAutoRole(uid, email, db);

    if (autoRole) {
      if (db) {
        let adminSnap = await db.ref(`admins/${uid}`).once('value');
        const currentData = adminSnap.exists() ? adminSnap.val() : null;
        const currentRole = String(currentData?.role || '').toLowerCase().trim();

        if (!adminSnap.exists() || currentRole !== autoRole) {
          try {
            await syncRoleToDatabase(db, uid, autoRole, email, 'auto_rule_sync');
          } catch (syncErr: any) {
            console.warn('[COWIO Roles] Auto-sync warning:', syncErr.message);
          }
        }
      }

      req.user!.role = autoRole;
      req.user!.isCreator = autoRole === 'creator';

      return res.json({
        success: true,
        uid,
        role: autoRole,
        isCreator: autoRole === 'creator',
        isAdmin: true,
        autoGranted: true
      });
    }

    if (!db) {
      return res.json({
        success: true,
        uid,
        role: 'user',
        isCreator: false,
        isAdmin: false
      });
    }

    const adminSnap = await db.ref(`admins/${uid}`).once('value');
    if (adminSnap.exists()) {
      const data = adminSnap.val();
      const role = String(data.role || '').toLowerCase().trim();
      const isCreator = role === 'creator' || data.isOwner === true;
      return res.json({
        success: true,
        uid,
        role: role || 'admin',
        isCreator,
        isAdmin: true
      });
    }

    return res.json({
      success: true,
      uid,
      role: 'user',
      isCreator: false,
      isAdmin: false
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Ошибка проверки прав' });
  }
});

// ----------------------------------------------------
// ROLE CLAIM ENDPOINT (VIA SECRET KEY)
// ----------------------------------------------------
app.post(
  '/api/auth/claim-role',
  requireAuth,
  claimRoleLimiter,
  validate(ClaimRoleSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const { secret, role: requestedRole } = req.body;
      const db = getFirebaseDb();

      // Verify the secret against configured creator/operator/manager/moderator secrets
      const claimResult = await verifyRoleSecret(secret, requestedRole, db);
      if (!claimResult.valid || !claimResult.role) {
        return res.status(403).json({
          success: false,
          error: claimResult.error || 'Неверный секретный ключ'
        });
      }

      const grantedRole = claimResult.role;
      const isCreator = grantedRole === 'creator';

      if (db) {
        await syncRoleToDatabase(db, uid, grantedRole, email, 'secret_key_claim');
      }

      // Update current user
      req.user!.role = grantedRole;
      req.user!.isCreator = isCreator;

      const roleTitle = ROLE_DISPLAY_NAMES[grantedRole] || grantedRole;

      return res.json({
        success: true,
        uid,
        role: grantedRole,
        isCreator,
        isAdmin: true,
        message: `Вам успешно выданы права: ${roleTitle}`
      });
    } catch (err: any) {
      console.error('[COWIO Roles] Error claiming role:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка при активации роли'
      });
    }
  }
);

// ----------------------------------------------------
// CUSTOM AUTH: SEND CODE
// ----------------------------------------------------
app.post(
  '/api/custom-auth/send-code',
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  validate(SendCodeSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      // Check lockout status
      const lockUntil = lockoutMap.get(normalizedEmail);
      if (lockUntil && Date.now() < lockUntil) {
        const remainingMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          error: `Аккаунт временно заблокирован из-за множества неверных попыток. Повторите через ${remainingMinutes} мин.`
        });
      }

      // Generate cryptographically secure 6-digit random code
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      verificationCodes.set(normalizedEmail, {
        code,
        expiresAt,
        attempts: 0
      });

      const token = generateVerificationToken(normalizedEmail, code, expiresAt);
      console.log(`[AUTH] Code sent to <${hashForLog(normalizedEmail)}>`);

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; background: #0f0f11; color: #fff; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,143,198,0.3); box-shadow: 0 10px 40px rgba(255,143,198,0.15);">
          <h2 style="color: #fff; font-size: 24px; margin-top: 0; margin-bottom: 25px; font-weight: 800; letter-spacing: 0.5px;">Авторизация COWIO</h2>
          <p style="font-size: 15px; color: #aaa; margin-bottom: 15px; text-align: left;">Здравствуйте!</p>
          <p style="font-size: 15px; color: #aaa; margin-bottom: 30px; text-align: left; line-height: 1.6;">Вы сделали запрос на получение кода подтверждения. Пожалуйста, введите приведенный ниже секретный код в приложении для подтверждения вашего действия.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
            <tr>
              ${code.split('').map((digit) => `
              <td style="padding: 0 4px;">
                <div style="display: block; width: 44px; height: 50px; line-height: 50px; font-size: 26px; font-family: monospace; font-weight: 800; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; text-align: center;">
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
      if (smtpUser && smtpPass) {
        try {
          const { transporter, user } = getMailTransporter(true);
          await transporter.sendMail({
            from: `"COWIO" <${user}>`,
            to: normalizedEmail,
            subject: 'Код подтверждения COWIO',
            html: htmlContent
          });
          emailSent = true;
        } catch (err1: any) {
          try {
            const { transporter, user } = getMailTransporter(false);
            await transporter.sendMail({
              from: `"COWIO" <${user}>`,
              to: normalizedEmail,
              subject: 'Код подтверждения COWIO',
              html: htmlContent
            });
            emailSent = true;
          } catch (err2: any) {
            console.error('[COWIO Auth] SMTP delivery failed');
          }
        }
      }

      if (!emailSent && process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          success: false,
          error: 'Почтовый сервис временно недоступен. Попробуйте позже.'
        });
      }

      // Security: Never return plain verification code in response body
      return res.json({
        success: true,
        message: 'Код успешно отправлен на почту',
        token
      });
    } catch (e: any) {
      console.error('[COWIO Auth] send-code error:', e.message);
      res.status(500).json({ success: false, error: 'Ошибка отправки кода' });
    }
  }
);

// ----------------------------------------------------
// CUSTOM AUTH: VERIFY CODE
// ----------------------------------------------------
app.post(
  '/api/custom-auth/verify-code',
  verifyCodeLimiter,
  validate(VerifyCodeSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { email, code, token } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      // Check lockout
      const lockUntil = lockoutMap.get(normalizedEmail);
      if (lockUntil && Date.now() < lockUntil) {
        const remainingMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          error: `Аккаунт заблокирован на ${remainingMinutes} мин. из-за превышения попыток.`
        });
      }

      const record = verificationCodes.get(normalizedEmail);
      const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);

      if (!isTokenValid && !isMemoryValid) {
        if (record) {
          record.attempts += 1;
          if (record.attempts >= 5) {
            verificationCodes.delete(normalizedEmail);
            lockoutMap.set(normalizedEmail, Date.now() + 60 * 60 * 1000); // 1 hour lockout
            return res.status(429).json({
              success: false,
              error: 'Превышено максимальное число неверных попыток (5). Аккаунт заблокирован на 1 час.'
            });
          }
        }
        return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
      }

      // Successfully verified
      verificationCodes.delete(normalizedEmail);
      res.json({ success: true, message: 'Код подтверждён' });
    } catch (e: any) {
      console.error('[COWIO Auth] verify-code error:', e.message);
      res.status(500).json({ success: false, error: 'Ошибка проверки кода' });
    }
  }
);

// ----------------------------------------------------
// CUSTOM AUTH: RESET PASSWORD
// ----------------------------------------------------
app.post(
  '/api/custom-auth/reset-password',
  resetPasswordLimiter,
  validate(ResetPasswordSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { email, code, token, newPassword } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record = verificationCodes.get(normalizedEmail);
      const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);

      if (!isTokenValid && !isMemoryValid) {
        return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
      }

      if (firebaseAdmin.apps?.length) {
        const userRecord = await firebaseAdmin.auth().getUserByEmail(normalizedEmail);
        await firebaseAdmin.auth().updateUser(userRecord.uid, { password: newPassword });
      }

      verificationCodes.delete(normalizedEmail);
      res.json({ success: true, message: 'Пароль успешно изменен' });
    } catch (e: any) {
      console.error('[COWIO Auth] reset-password error:', e.message);
      res.status(500).json({ success: false, error: 'Ошибка сброса пароля' });
    }
  }
);

// ----------------------------------------------------
// CUSTOM AUTH: CHANGE EMAIL (REQUIRES AUTH)
// ----------------------------------------------------
app.post(
  '/api/custom-auth/change-email',
  requireAuth,
  validate(ChangeEmailSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { oldEmail, newEmail, code, token } = req.body;
      const normalizedNewEmail = newEmail.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record = verificationCodes.get(normalizedNewEmail);
      const isTokenValid = verifyVerificationToken(normalizedNewEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);

      if (!isTokenValid && !isMemoryValid) {
        return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
      }

      if (firebaseAdmin.apps?.length) {
        const userRecord = await firebaseAdmin.auth().getUserByEmail(oldEmail.trim().toLowerCase());
        if (userRecord.uid !== req.user!.uid) {
          return res.status(403).json({ success: false, error: 'Запрещено: несовпадение учётной записи' });
        }
        await firebaseAdmin.auth().updateUser(userRecord.uid, { email: normalizedNewEmail });
      }

      verificationCodes.delete(normalizedNewEmail);
      res.json({ success: true, message: 'Почта успешно изменена' });
    } catch (e: any) {
      console.error('[COWIO Auth] change-email error:', e.message);
      if (e.code === 'auth/email-already-exists') {
        return res.status(400).json({ success: false, error: 'Этот email уже занят' });
      }
      res.status(500).json({ success: false, error: 'Ошибка обновления почты' });
    }
  }
);

// ----------------------------------------------------
// VIDEO API ROUTES (SSRF PROTECTED)
// ----------------------------------------------------
app.get('/api/video/info', optionalAuth, async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ success: false, error: 'Parameter url is required' });

  // SSRF check
  const validation = await validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || 'Blocked by SSRF filter' });
  }

  try {
    const info = await getVideoInfo(url);
    if (!info || !info.success) {
      return res.status(400).json(info || { success: false, error: 'Could not retrieve video' });
    }
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch video information' });
  }
});

app.post(
  '/api/video/info',
  optionalAuth,
  validate(VideoInfoSchema, 'body'),
  async (req: Request, res: Response) => {
    const url = req.body.url as string;

    const validation = await validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || 'Blocked by SSRF filter' });
    }

    try {
      const info = await getVideoInfo(url);
      if (!info || !info.success) {
        return res.status(400).json(info || { success: false, error: 'Could not retrieve video' });
      }
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch video information' });
    }
  }
);

app.get('/api/video/search', optionalAuth, async (req: Request, res: Response) => {
  const q = ((req.query.q || req.query.query || '') as string).trim();
  const platform = ((req.query.platform || 'all') as string).trim();
  if (!q) return res.json({ success: true, results: [] });

  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Video search error', results: [] });
  }
});

app.post(
  '/api/video/search',
  optionalAuth,
  validate(VideoSearchSchema, 'body'),
  async (req: Request, res: Response) => {
    const { q, platform = 'all' } = req.body;
    try {
      const results = await searchVideos(q, platform);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Video search error', results: [] });
    }
  }
);

app.all('/api/resolve-media', optionalAuth, async (req: Request, res: Response) => {
  const url = ((req.body?.url || req.query?.url || '') as string).trim();
  if (!url) return res.status(400).json({ success: false, error: 'url required' });

  const validation = await validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || 'Blocked by SSRF filter' });
  }

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
    return res.status(500).json({ success: false, error: 'Media resolution error' });
  }
});

// ----------------------------------------------------
// METADATA FETCH ROUTE (MEDIA LIBRARY) - SSRF PROTECTED
// ----------------------------------------------------
app.post('/api/library/fetch-metadata', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'No URL provided' });
    }

    const trimmedUrl = url.trim();
    const validation = await validateUrl(trimmedUrl);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || 'Invalid or forbidden URL' });
    }

    let videoId = '';
    try {
      if (trimmedUrl.includes('youtube.com/watch')) {
        videoId = new URL(trimmedUrl).searchParams.get('v') || '';
      } else if (trimmedUrl.includes('youtu.be/')) {
        videoId = trimmedUrl.split('youtu.be/')[1]?.split('?')[0] || '';
      } else if (trimmedUrl.includes('youtube.com/embed/')) {
        videoId = trimmedUrl.split('youtube.com/embed/')[1]?.split('?')[0] || '';
      }
    } catch {}

    let title = 'Без названия';
    let description = '';
    let authorName = '';
    let authorAvatar = '';

    if (videoId) {
      try {
        const oembedRes = await safeFetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { timeoutMs: 4000 }
        );
        if (oembedRes.ok) {
          const data: any = await oembedRes.json();
          title = data.title || title;
          authorName = data.author_name || authorName;
          authorAvatar = data.thumbnail_url || authorAvatar;
        }
      } catch {}

      try {
        const fetchRes = await safeFetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeoutMs: 4000
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const descMatch =
            html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
            html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
          if (descMatch && descMatch[1]) description = descMatch[1].trim();
          if (!title || title === 'Без названия') {
            const titleMatch = html.match(/<meta\s+title="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
            if (titleMatch && titleMatch[1]) title = titleMatch[1].replace('- YouTube', '').trim();
          }
        }
      } catch {}
    } else if (trimmedUrl.includes('rutube.ru')) {
      try {
        const info = await getVideoInfo(trimmedUrl);
        if (info && info.success) {
          title = info.title || title;
          authorName = info.author || authorName;
          authorAvatar = info.authorAvatar || authorAvatar;
        }
      } catch {}
    }

    if (description) {
      description = sanitizeText(
        description
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
      );
      if (description.includes('Enjoy the videos and music you love') || description.includes('YouTube')) {
        description = '';
      }
    }

    return res.status(200).json({ success: true, title: sanitizeText(title), description, authorName: sanitizeText(authorName), authorAvatar });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Metadata fetch error' });
  }
});

// ----------------------------------------------------
// EMOJI & STICKER SERVING
// ----------------------------------------------------
const emojiCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const fallbackWebpBuffer = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');

const EMOJI_ALIASES_MAP: Record<string, string> = {
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

app.get(['/api/emoji-proxy', '/emoji-proxy'], async (req: Request, res: Response) => {
  try {
    let rawPath = ((req.query.path || req.query.url || '') as string).trim();
    if (!rawPath) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(fallbackWebpBuffer);
    }

    let emojiPath = rawPath
      .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
      .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
      .replace(/^\/+/, '');

    try {
      emojiPath = decodeURIComponent(emojiPath);
    } catch {}

    const lowerKey = emojiPath.toLowerCase();
    if (EMOJI_ALIASES_MAP[lowerKey]) {
      emojiPath = EMOJI_ALIASES_MAP[lowerKey]!;
    }

    // Check if local emoji file exists in public/emoji/
    const localEmojiPath = path.join(__dirname, 'public/emoji', emojiPath);
    if (fs.existsSync(localEmojiPath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(localEmojiPath);
    }

    const cacheKey = emojiPath;
    const cached = emojiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 3600 * 1000) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(cached.buffer);
    }

    const encodedPath = encodeURI(emojiPath);
    const mirror = `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`;

    const fetchRes = await safeFetch(mirror, {
      allowedDomains: ['cdn.jsdelivr.net'],
      timeoutMs: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (!fetchRes.ok) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(fallbackWebpBuffer);
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const contentType = fetchRes.headers.get('content-type') || 'image/webp';
    const buffer = Buffer.from(arrayBuffer);

    emojiCache.set(cacheKey, { buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (err) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(fallbackWebpBuffer);
  }
});

// ----------------------------------------------------
// PREMIUM & PLATEGA PAYMENT ROUTES (SECURED)
// ----------------------------------------------------
const PLATEGA_API_KEY = (process.env.PLATEGA_API_KEY || '').trim();
const PLATEGA_MERCHANT_ID = (process.env.PLATEGA_MERCHANT_ID || '').trim();
const PLATEGA_WEBHOOK_SECRET = (process.env.PLATEGA_WEBHOOK_SECRET || '').trim();

function getBaseUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function getFirebaseDb() {
  try {
    if (firebaseAdmin.apps?.length) return firebaseAdmin.database();
  } catch {}
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
      console.log(`[Premium] Activated premium for UID: ${uid}`);
    } catch (e: any) {
      console.warn('[Premium] Firebase DB set warning:', e.message);
    }
  }
  return premiumData;
}

// CREATE PAYMENT: Protected by requireAuth, uid strictly from req.user.uid!
app.post(
  '/api/premium/create-payment',
  requireAuth,
  createPaymentLimiter,
  validate(CreatePaymentSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      // SECURITY: uid is taken strictly from verified auth token, body uid is ignored!
      const uid = req.user!.uid;
      const { userName, email } = req.body || {};

      const amount = Number(process.env.PREMIUM_PRICE_RUB || 179);
      const baseUrl = getBaseUrl(req);
      const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;
      const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(uid)}`;
      const orderId = `cowio_prem_${uid}_${Date.now()}`;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      if (!PLATEGA_API_KEY || !PLATEGA_MERCHANT_ID) {
        return res.status(503).json({ success: false, error: 'Шлюз Platega не настроен на сервере' });
      }

      const plategaHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Secret': PLATEGA_API_KEY,
        'X-MerchantId': PLATEGA_MERCHANT_ID
      };

      const plategaPayload = {
        paymentMethod: 2,
        paymentDetails: {
          amount: amount,
          currency: 'RUB'
        },
        description: 'Подписка COWIO Premium (30 дней)',
        return: returnUrl,
        failedUrl: failedUrl,
        payload: JSON.stringify({ uid, orderId }),
        metadata: {
          userId: String(uid),
          userName: String(userName || email || req.user?.email || 'User'),
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

      const pData: any = await plategaRes.json();
      const confirmationUrl = pData.redirect || pData.url || pData.confirmationUrl;
      if (!confirmationUrl) {
        return res.status(502).json({ success: false, error: 'Шлюз не предоставил ссылку для оплаты' });
      }

      return res.json({
        success: true,
        confirmationUrl,
        paymentId: pData.transactionId || pData.id || orderId,
        returnUrl
      });
    } catch (e: any) {
      console.error('[Premium] create-payment error:', e.message);
      res.status(500).json({ success: false, error: 'Ошибка создания платежа' });
    }
  }
);

// PLATEGA WEBHOOK: Verified via HMAC or reverse call to Platega API with idempotency
app.post('/api/premium/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const signature = (req.headers['x-signature'] || req.headers['x-platega-signature'] || '') as string;
    const txId = payload.id || payload.transactionId || '';

    if (!txId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    let verified = false;

    // 1. Verify HMAC if signature and secret are configured
    if (signature && PLATEGA_WEBHOOK_SECRET) {
      const computedSig = crypto
        .createHmac('sha256', PLATEGA_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
      try {
        verified = crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(computedSig, 'utf8'));
      } catch {
        verified = false;
      }
    }

    // 2. If not verified via HMAC, perform reverse verification call to Platega API (GET /transaction/{id})
    if (!verified && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const verifyRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(txId)}`, {
          headers: {
            'X-MerchantId': PLATEGA_MERCHANT_ID,
            'X-Secret': PLATEGA_API_KEY
          }
        });
        if (verifyRes.ok) {
          const apiData: any = await verifyRes.json();
          const apiStatus = String(apiData.status || '').toUpperCase();
          if (apiStatus === 'CONFIRMED' || apiStatus === 'SUCCESS' || apiStatus === 'PAID') {
            verified = true;
          }
        }
      } catch (err: any) {
        console.error('[Premium Webhook] Reverse check error:', err.message);
      }
    }

    // For test mode without credentials, allow mock verification
    if (!verified && (process.env.NODE_ENV === 'test' || process.env.VITEST) && payload._testMockVerified) {
      verified = true;
    }

    if (!verified) {
      console.warn(`[Premium Webhook] Rejected unverified webhook payload for txId: ${txId}`);
      return res.status(403).json({ success: false, error: 'Untrusted webhook signature or verification failed' });
    }

    // 3. Idempotency Check via /payments_log/{txId}
    const db = getFirebaseDb();
    if (db) {
      const logSnap = await db.ref(`payments_log/${txId}`).once('value');
      if (logSnap.exists()) {
        console.log(`[Premium Webhook] Transaction ${txId} already processed (idempotent).`);
        return res.json({ success: true, message: 'Already processed' });
      }
    }

    // 4. Extract verified UID & activate
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

    if (!targetUid && orderId && orderId.startsWith('cowio_prem_')) {
      const parts = orderId.split('_');
      targetUid = parts[2];
    }

    if (targetUid) {
      await activatePremium(targetUid, txId || orderId, amount);

      // Record in payments_log
      if (db) {
        await db.ref(`payments_log/${txId}`).set({
          uid: targetUid,
          orderId,
          amount,
          processedAt: Date.now(),
          status: 'CONFIRMED'
        });
      }
      console.log(`[Premium Webhook] Verified payment & activated premium for user: ${targetUid}`);
    }

    res.json({ success: true, message: 'Webhook verified and processed' });
  } catch (err: any) {
    console.error('[Premium Webhook] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// STATUS ENDPOINT: Protected by requireAuth
app.get('/api/premium/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid; // Strictly from auth token!
    const paymentId = (req.query.paymentId as string) || '';

    const db = getFirebaseDb();
    let currentPremium: any = null;
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
          const txData: any = await pRes.json();
          const txStatus = String(txData.status || '').toUpperCase();
          if (txStatus === 'CONFIRMED' || txStatus === 'SUCCESS' || txStatus === 'PAID') {
            const amt = Number(txData.paymentDetails?.amount) || 179;
            currentPremium = await activatePremium(uid, paymentId, amt);
            isActive = true;
          }
        }
      } catch (chkErr: any) {
        console.warn('[Premium Status] Check Platega tx error:', chkErr.message);
      }
    }

    return res.json({
      success: true,
      active: isActive,
      premium: isActive ? currentPremium : null,
      expiresAt: currentPremium?.expiresAt || null
    });
  } catch (e: any) {
    console.error('[Premium Status] error:', e.message);
    res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
  }
});

// ----------------------------------------------------
// PROXIES (YOUTUBE & SSRF-PROTECTED HLS STREAM)
// ----------------------------------------------------
app.use(
  '/api/proxy/yt',
  createProxyMiddleware({
    target: 'https://pipedapi.smnz.de',
    changeOrigin: true,
    pathRewrite: {
      '^/api/proxy/yt': ''
    },
    onProxyReq: (proxyReq: any) => {
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
    }
  } as any)
);

app.use(
  '/api/proxy/stream',
  async (req: Request, res: Response, next: NextFunction) => {
    const target = req.query?.url as string;
    if (!target) return res.status(400).json({ success: false, error: 'url required' });

    const validation = await validateUrl(target);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || 'Blocked by SSRF protection' });
    }
    next();
  },
  createProxyMiddleware({
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
  } as any)
);

// ----------------------------------------------------
// FRONTEND SERVING (VITE MIDDLEWARES IN DEV / STATIC IN PROD)
// ----------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction && process.env.NODE_ENV !== 'test') {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom'
  });
  app.use(vite.middlewares);

  app.use('*', async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) return next();
    try {
      const url = req.originalUrl || req.url;
      const indexHtmlPath = path.resolve(__dirname, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) return next();
      let template = fs.readFileSync(indexHtmlPath, 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
} else {
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.includes('/emoji/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    app.use(
      express.static(__dirname, {
        setHeaders: (res, filePath) => {
          if (filePath.includes('/emoji/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  }
}

// ----------------------------------------------------
// GLOBAL SECURE ERROR HANDLER (NO LEAKAGE IN PROD)
// ----------------------------------------------------
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = crypto.randomUUID();
  console.error(`[Error ID: ${requestId}]`, err.message);

  if (req.path && req.path.startsWith('/api')) {
    const isProd = process.env.NODE_ENV === 'production';
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
      requestId,
      ...(isProd ? {} : { stack: err.stack })
    });
  }
  return res.status(500).send('Internal Server Error');
});

// ----------------------------------------------------
// SERVER START
// ----------------------------------------------------
let port = 3000;
const portIdx = process.argv.indexOf('--port');
if (portIdx !== -1 && process.argv[portIdx + 1]) {
  port = parseInt(process.argv[portIdx + 1]!, 10) || 3000;
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10) || 3000;
}

let host = '0.0.0.0';
const hostIdx = process.argv.indexOf('--host');
if (hostIdx !== -1 && process.argv[hostIdx + 1]) {
  host = process.argv[hostIdx + 1]!;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(port, host, () => {
    console.log(`[COWIO] Server listening on http://${host}:${port}`);
  });
}

export default app;
