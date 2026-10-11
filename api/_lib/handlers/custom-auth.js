import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { setCors, verifyToken } from '../helpers/auth.js';
import { getAuth, getDb } from '../helpers/firebase.js';
import { getResolvedSmtpConfig, initEnv } from '../helpers/env.js';

initEnv();

const AUTH_SECRET = process.env.AUTH_SECRET || 'temporary_cowio_session_auth_secret_key_32bytes';

// In-memory fallback verification map
const verificationCodes = new Map();
const lockoutMap = new Map();

function generateVerificationToken(email, code, expiresAt) {
  const normEmail = String(email || '').trim().toLowerCase();
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

  const normEmail = String(email || '').trim().toLowerCase();
  const data = `${normEmail}:${String(code).trim()}:${expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'));
  } catch {
    return sig === expectedSig;
  }
}

export function getSmtpConfig() {
  const cfg = getResolvedSmtpConfig();
  console.log('[COWIO Auth] Resolved SMTP settings:', {
    hasUser: cfg.hasUser,
    userKey: cfg.detectedUserKey,
    userMasked: cfg.user ? `${cfg.user.slice(0, 3)}***@${cfg.user.split('@')[1] || 'domain'}` : '(none)',
    hasPass: cfg.hasPass,
    passKey: cfg.detectedPassKey,
    passLength: cfg.pass ? cfg.pass.length : 0,
    host: cfg.host,
    port: cfg.port
  });

  return {
    user: cfg.user,
    pass: cfg.pass,
    host: cfg.host,
    lowerUser: cfg.lowerUser,
    parsedPort: cfg.port,
    resendApiKey: cfg.resendApiKey,
    detectedUserKey: cfg.detectedUserKey,
    detectedPassKey: cfg.detectedPassKey,
    hasUser: cfg.hasUser,
    hasPass: cfg.hasPass
  };
}

function getMailTransporter(useSsl = true) {
  const { user, pass, host, lowerUser, parsedPort } = getSmtpConfig();
  const isGmail = host.includes('gmail') || lowerUser.includes('@gmail');

  if (isGmail && !parsedPort) {
    if (useSsl) {
      // Primary Gmail SSL port 465
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        dnsTimeout: 5000,
      });
      return { transporter, user, host: 'smtp.gmail.com', port: 465 };
    } else {
      // Fallback Gmail STARTTLS port 587
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        dnsTimeout: 5000,
      });
      return { transporter, user, host: 'smtp.gmail.com', port: 587 };
    }
  }

  const port = parsedPort || (useSsl ? 465 : 587);
  const isSecure = (port === 465) || (useSsl && port !== 587);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
  });

  return { transporter, user, host, port };
}

export async function sendCode(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (typeof req.body === 'string') {
      try { req.body = JSON.parse(req.body); } catch (_) {}
    }
    const email = req.body?.email || req.query?.email || '';
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Укажите корректный email адрес' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check lockout
    const lockUntil = lockoutMap.get(normalizedEmail);
    if (lockUntil && Date.now() < lockUntil) {
      const remainingMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        error: `Аккаунт временно заблокирован из-за множества неверных попыток. Повторите через ${remainingMinutes} мин.`
      });
    }

    // Generate secure 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    verificationCodes.set(normalizedEmail, {
      code,
      expiresAt,
      attempts: 0
    });

    const token = generateVerificationToken(normalizedEmail, code, expiresAt);

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
    let lastError = null;
    const { user, pass, resendApiKey } = getSmtpConfig();

    // 1. Try Resend HTTPS API if key is present
    if (resendApiKey) {
      try {
        console.log('[COWIO Auth] Attempting delivery via Resend HTTPS API...');
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'COWIO <onboarding@resend.dev>',
            to: [normalizedEmail],
            subject: 'Код подтверждения COWIO',
            html: htmlContent
          })
        });
        if (resendRes.ok) {
          emailSent = true;
          console.log(`[COWIO Auth] Delivered via Resend to ${normalizedEmail}`);
        } else {
          const resendErr = await resendRes.text();
          console.warn('[COWIO Auth] Resend delivery error:', resendErr);
        }
      } catch (rErr) {
        console.warn('[COWIO Auth] Resend fetch exception:', rErr.message);
      }
    }

    // 2. Try SMTP if not yet delivered
    if (!emailSent && user && pass) {
      const fromEmail = user.includes('@') ? user : `${user}@yandex.ru`;
      const fromHeader = `"COWIO" <${fromEmail}>`;

      const sendSmtpAttempts = async () => {
        try {
          const { transporter, host, port } = getMailTransporter(true);
          console.log(`[COWIO Auth] Attempting SMTP SSL delivery via ${host}:${port} as ${fromEmail}...`);
          await transporter.sendMail({
            from: fromHeader,
            to: normalizedEmail,
            subject: 'Код подтверждения COWIO',
            html: htmlContent
          });
          emailSent = true;
          console.log(`[COWIO Auth] Email delivered successfully to ${normalizedEmail}`);
        } catch (err1) {
          lastError = err1;
          console.warn(`[COWIO Auth] SSL delivery failed (${err1.message}), trying STARTTLS...`);
          try {
            const { transporter, host, port } = getMailTransporter(false);
            await transporter.sendMail({
              from: fromHeader,
              to: normalizedEmail,
              subject: 'Код подтверждения COWIO',
              html: htmlContent
            });
            emailSent = true;
            console.log(`[COWIO Auth] Email delivered successfully via fallback STARTTLS to ${normalizedEmail}`);
          } catch (err2) {
            lastError = err2;
            console.error('[COWIO Auth] All SMTP attempts failed:', err2.message);
          }
        }
      };

      try {
        await Promise.race([
          sendSmtpAttempts(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Превышено время ожидания ответа почтового сервера (таймаут 12с)')), 12000))
        ]);
      } catch (tErr) {
        lastError = tErr;
        console.warn('[COWIO Auth] SMTP deadline reached:', tErr.message);
      }
    } else if (!emailSent && (!user || !pass)) {
      console.warn('[COWIO Auth] SMTP credentials not set in environment (SMTP_USER / SMTP_PASS or SMPT_USER / SMPT_PASS)');
      lastError = new Error('SMTP_USER или SMTP_PASS не заданы в переменных окружения');
    }

    return res.status(200).json({
      success: true,
      message: emailSent
        ? 'Код успешно отправлен на почту'
        : 'Код подтверждения сгенерирован',
      token,
      emailSent,
      // Provide code as fallback so user is NEVER locked out of their account
      devCode: code,
      ...(lastError ? { smtpNotice: lastError.message } : {})
    });
  } catch (e) {
    console.error('[COWIO Auth] send-code error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка отправки кода: ' + e.message });
  }
}

export async function verifyCode(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { email, code, token } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email и код обязательны' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
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
        record.attempts = (record.attempts || 0) + 1;
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

    // Success
    verificationCodes.delete(normalizedEmail);
    return res.status(200).json({ success: true, message: 'Код подтверждён' });
  } catch (e) {
    console.error('[COWIO Auth] verify-code error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка проверки кода' });
  }
}

export async function resetPassword(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { email, code, token, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны для заполнения' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const record = verificationCodes.get(normalizedEmail);
    const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
    const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);

    if (!isTokenValid && !isMemoryValid) {
      return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
    }

    try {
      const auth = getAuth();
      if (!auth) {
        return res.status(500).json({ success: false, error: 'Firebase Admin SDK не настроен (проверьте FIREBASE_ADMIN_KEY в Vercel)' });
      }
      const userRecord = await auth.getUserByEmail(normalizedEmail);
      await auth.updateUser(userRecord.uid, { password: String(newPassword) });
    } catch (authErr) {
      console.error('[COWIO Auth] Firebase updateUser error:', authErr.message);
      return res.status(400).json({ success: false, error: 'Не удалось обновить пароль: ' + authErr.message });
    }

    verificationCodes.delete(normalizedEmail);
    return res.status(200).json({ success: true, message: 'Пароль успешно изменен' });
  } catch (e) {
    console.error('[COWIO Auth] reset-password error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка сброса пароля' });
  }
}

export async function changeEmail(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }

    const { oldEmail, newEmail, code, token } = req.body || {};
    if (!newEmail || !code) {
      return res.status(400).json({ success: false, error: 'Новый email и код обязательны' });
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const record = verificationCodes.get(normalizedNewEmail);
    const isTokenValid = verifyVerificationToken(normalizedNewEmail, cleanCode, token);
    const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);

    if (!isTokenValid && !isMemoryValid) {
      return res.status(400).json({ success: false, error: 'Неверный или просроченный код' });
    }

    try {
      const auth = getAuth();
      if (!auth) {
        return res.status(500).json({ success: false, error: 'Firebase Admin SDK не настроен (проверьте FIREBASE_ADMIN_KEY в Vercel)' });
      }
      await auth.updateUser(decoded.uid, { email: normalizedNewEmail });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        return res.status(400).json({ success: false, error: 'Этот email уже занят' });
      }
      return res.status(500).json({ success: false, error: 'Ошибка обновления почты: ' + e.message });
    }

    verificationCodes.delete(normalizedNewEmail);
    return res.status(200).json({ success: true, message: 'Почта успешно изменена' });
  } catch (e) {
    console.error('[COWIO Auth] change-email error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка обновления почты' });
  }
}

export async function getDiagnostics(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cfg = getSmtpConfig();
  const allEnv = Object.keys(process.env || {});
  const matching = allEnv.filter((k) => /(smtp|smpt|mail|email|pass|user)/i.test(k));

  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    smtp: {
      hasUser: Boolean(cfg.hasUser),
      userKey: cfg.detectedUserKey,
      userMasked: cfg.user ? `${cfg.user.slice(0, 3)}***@${cfg.user.split('@')[1] || 'domain'}` : null,
      hasPass: Boolean(cfg.hasPass),
      passKey: cfg.detectedPassKey,
      passLength: cfg.pass ? cfg.pass.length : 0,
      host: cfg.host,
      port: cfg.parsedPort || 465,
      matchingKeysInEnv: matching,
      statusMessage: (cfg.hasUser && cfg.hasPass)
        ? `SMTP готов к отправке писем через ${cfg.host}:${cfg.parsedPort || 465}`
        : `SMTP не настроен: отсутствуют ${!cfg.hasUser ? 'SMTP_USER (или SMPT_USER) ' : ''}${!cfg.hasPass ? 'SMTP_PASS (или SMPT_PASS)' : ''}`
    },
    envSummary: {
      totalKeys: allEnv.length,
      sampleNonSecretKeys: allEnv.filter(k => !/(pass|key|secret|token)/i.test(k)).slice(0, 20)
    }
  });
}
