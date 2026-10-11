import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let envInitialized = false;

/**
 * Initializes and normalizes environment variables across all runtimes:
 * Vercel Serverless Functions, Vite dev server, standalone Express server,
 * and local development with .env / .env.local / .env.production files.
 */
export function initEnv() {
  if (envInitialized) {
    return process.env;
  }

  // 1. Attempt to load local environment files if present on disk
  try {
    const cwd = process.cwd();
    const envFiles = [
      path.resolve(cwd, '.env.local'),
      path.resolve(cwd, '.env.production.local'),
      path.resolve(cwd, '.env.production'),
      path.resolve(cwd, '.env.development.local'),
      path.resolve(cwd, '.env.development'),
      path.resolve(cwd, '.env')
    ];

    for (const filePath of envFiles) {
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = dotenv.parse(content);
          for (const [k, v] of Object.entries(parsed)) {
            // Do not override existing non-empty process.env variables from Vercel
            if (!process.env[k] || process.env[k].trim() === '') {
              process.env[k] = v;
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // 2. Clean and normalize all keys in process.env
  try {
    const entries = Object.entries(process.env);
    for (const [rawKey, rawVal] of entries) {
      if (typeof rawVal !== 'string') continue;

      const trimmedKey = rawKey.trim();
      let cleanedVal = rawVal.trim().replace(/^[\r\n]+|[\r\n]+$/g, '');

      // Strip outer quotes if any
      if (
        (cleanedVal.startsWith('"') && cleanedVal.endsWith('"')) ||
        (cleanedVal.startsWith("'") && cleanedVal.endsWith("'"))
      ) {
        cleanedVal = cleanedVal.slice(1, -1).trim();
      }

      if (trimmedKey !== rawKey) {
        process.env[trimmedKey] = cleanedVal;
      } else {
        process.env[rawKey] = cleanedVal;
      }
    }
  } catch (_) {}

  // 3. Normalize common typos and aliases, specifically SMPT_* vs SMTP_*
  try {
    const aliasPairs = [
      // SMPT typo -> standard SMTP
      ['SMPT_USER', 'SMTP_USER'],
      ['SMPT_PASS', 'SMTP_PASS'],
      ['SMPT_PASSWORD', 'SMTP_PASS'],
      ['SMPT_HOST', 'SMTP_HOST'],
      ['SMPT_PORT', 'SMTP_PORT'],
      ['SMPT_KEY', 'SMTP_PASS'],
      ['SMPT_LOGIN', 'SMTP_USER'],
      ['SMPT_USERNAME', 'SMTP_USER'],
      ['SMPT_EMAIL', 'SMTP_USER'],

      // SMTP variants
      ['SMTP_PASSWORD', 'SMTP_PASS'],
      ['SMTP_KEY', 'SMTP_PASS'],
      ['SMTP_SECRET', 'SMTP_PASS'],
      ['SMTP_LOGIN', 'SMTP_USER'],
      ['SMTP_USERNAME', 'SMTP_USER'],
      ['SMTP_EMAIL', 'SMTP_USER'],

      // General email aliases
      ['EMAIL_USER', 'SMTP_USER'],
      ['EMAIL_LOGIN', 'SMTP_USER'],
      ['EMAIL_PASS', 'SMTP_PASS'],
      ['EMAIL_PASSWORD', 'SMTP_PASS'],
      ['MAIL_USER', 'SMTP_USER'],
      ['MAIL_PASS', 'SMTP_PASS'],
      ['MAIL_PASSWORD', 'SMTP_PASS'],

      // Vite / Vercel / Next prefixes
      ['VITE_SMTP_USER', 'SMTP_USER'],
      ['VITE_SMPT_USER', 'SMTP_USER'],
      ['VITE_SMTP_PASS', 'SMTP_PASS'],
      ['VITE_SMPT_PASS', 'SMTP_PASS'],
      ['VERCEL_SMTP_USER', 'SMTP_USER'],
      ['VERCEL_SMPT_USER', 'SMTP_USER'],
      ['VERCEL_SMTP_PASS', 'SMTP_PASS'],
      ['VERCEL_SMPT_PASS', 'SMTP_PASS'],
      ['NEXT_PUBLIC_SMTP_USER', 'SMTP_USER'],
      ['NEXT_PUBLIC_SMPT_USER', 'SMTP_USER'],
      ['NEXT_PUBLIC_SMTP_PASS', 'SMTP_PASS'],
      ['NEXT_PUBLIC_SMPT_PASS', 'SMTP_PASS'],
    ];

    for (const [alias, standard] of aliasPairs) {
      const aliasVal = process.env[alias];
      const standardVal = process.env[standard];

      if (aliasVal && !standardVal) {
        process.env[standard] = aliasVal;
      } else if (standardVal && !aliasVal) {
        process.env[alias] = standardVal;
      }
    }
  } catch (_) {}

  // 4. Case-insensitive lookup fallback if keys were saved in lowercase or mixed case
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      for (const [k, v] of Object.entries(process.env)) {
        if (!v || typeof v !== 'string' || !v.trim()) continue;
        const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!process.env.SMTP_USER && (
          lowerKey.includes('smtpuser') ||
          lowerKey.includes('smptuser') ||
          lowerKey.includes('smtplogin') ||
          lowerKey.includes('smptlogin') ||
          lowerKey.includes('smtpusername') ||
          lowerKey.includes('emailuser')
        )) {
          process.env.SMTP_USER = v.trim();
          process.env.SMPT_USER = v.trim();
        }

        if (!process.env.SMTP_PASS && (
          lowerKey.includes('smtppass') ||
          lowerKey.includes('smptpass') ||
          lowerKey.includes('smtppassword') ||
          lowerKey.includes('smptpassword') ||
          lowerKey.includes('emailpass') ||
          lowerKey.includes('emailpassword')
        )) {
          process.env.SMTP_PASS = v.trim();
          process.env.SMPT_PASS = v.trim();
        }
      }
    }
  } catch (_) {}

  // 5. Inspect JSON-containing environment variables (e.g. FIREBASE_ADMIN_KEY, GOOGLE_CREDENTIALS, SMTP_CONFIG)
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === 'string' && (v.trim().startsWith('{') || v.includes('private_key'))) {
          try {
            let raw = v.trim();
            if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
              raw = raw.slice(1, -1);
            }
            if (!raw.startsWith('{') && raw.length > 50) {
              try {
                const decoded = Buffer.from(raw, 'base64').toString('utf8');
                if (decoded.startsWith('{')) raw = decoded;
              } catch (_) {}
            }
            const parsed = JSON.parse(raw);
            if (!process.env.SMTP_USER) {
              const userVal = parsed.SMTP_USER || parsed.SMPT_USER || parsed.user || parsed.email;
              if (userVal) {
                process.env.SMTP_USER = String(userVal).trim();
                process.env.SMPT_USER = String(userVal).trim();
              }
            }
            if (!process.env.SMTP_PASS) {
              const passVal = parsed.SMTP_PASS || parsed.SMPT_PASS || parsed.pass || parsed.password;
              if (passVal) {
                process.env.SMTP_PASS = String(passVal).trim();
                process.env.SMPT_PASS = String(passVal).trim();
              }
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  envInitialized = true;
  return process.env;
}

/**
 * Returns sanitized, fully-resolved SMTP configuration.
 */
export function getResolvedSmtpConfig() {
  initEnv();

  const env = process.env;

  // 1. Detect and sanitize user
  const userCandidates = [
    'SMTP_USER',
    'SMPT_USER',
    'SMTP_USERNAME',
    'SMPT_USERNAME',
    'SMTP_LOGIN',
    'SMPT_LOGIN',
    'SMTP_EMAIL',
    'SMPT_EMAIL',
    'EMAIL_USER',
    'EMAIL_LOGIN',
    'MAIL_USER',
    'YANDEX_USER',
    'YANDEX_EMAIL',
    'GMAIL_USER',
    'GMAIL_EMAIL',
    'VITE_SMTP_USER',
    'VITE_SMPT_USER',
    'VERCEL_SMTP_USER',
    'VERCEL_SMPT_USER',
    'NEXT_PUBLIC_SMTP_USER',
    'NEXT_PUBLIC_SMPT_USER'
  ];

  let rawUser = '';
  let detectedUserKey = null;

  for (const k of userCandidates) {
    if (env[k] && String(env[k]).trim()) {
      rawUser = String(env[k]).trim();
      detectedUserKey = k;
      break;
    }
  }

  // Strip template placeholder angle brackets if present: e.g. <your-email@gmail.com> or <real@email.com>
  let user = rawUser.replace(/^<|>$/g, '').trim();
  // Strip outer quotes
  user = user.replace(/^["']|["']$/g, '').trim();

  // 2. Detect and sanitize password
  const passCandidates = [
    'SMTP_PASS',
    'SMPT_PASS',
    'SMTP_PASSWORD',
    'SMPT_PASSWORD',
    'SMTP_KEY',
    'SMPT_KEY',
    'SMTP_SECRET',
    'SMPT_SECRET',
    'EMAIL_PASS',
    'EMAIL_PASSWORD',
    'MAIL_PASS',
    'MAIL_PASSWORD',
    'YANDEX_PASS',
    'YANDEX_PASSWORD',
    'GMAIL_PASS',
    'GMAIL_PASSWORD',
    'VITE_SMTP_PASS',
    'VITE_SMPT_PASS',
    'VERCEL_SMTP_PASS',
    'VERCEL_SMPT_PASS',
    'NEXT_PUBLIC_SMTP_PASS',
    'NEXT_PUBLIC_SMPT_PASS'
  ];

  let rawPass = '';
  let detectedPassKey = null;

  for (const k of passCandidates) {
    if (env[k] && String(env[k]).trim()) {
      rawPass = String(env[k]).trim();
      detectedPassKey = k;
      break;
    }
  }

  let pass = rawPass.replace(/^<|>$/g, '').trim();
  pass = pass.replace(/^["']|["']$/g, '').trim();

  // Strip all whitespace from password (especially important for 16-char Google App Passwords like "abcd efgh ijkl mnop")
  if (pass) {
    pass = pass.replace(/\s+/g, '');
  }

  // 3. Detect host & port
  let host = (
    env.SMTP_HOST ||
    env.SMPT_HOST ||
    env.VITE_SMTP_HOST ||
    env.EMAIL_HOST ||
    env.MAIL_HOST ||
    env.YANDEX_HOST ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const lowerUser = user.toLowerCase();

  if (!host || !host.includes('.')) {
    if (lowerUser.includes('@yandex') || lowerUser.includes('@ya.ru')) {
      host = 'smtp.yandex.ru';
    } else if (
      lowerUser.includes('@mail.ru') ||
      lowerUser.includes('@bk.ru') ||
      lowerUser.includes('@inbox.ru') ||
      lowerUser.includes('@list.ru')
    ) {
      host = 'smtp.mail.ru';
    } else if (lowerUser.includes('@rambler.ru')) {
      host = 'smtp.rambler.ru';
    } else if (lowerUser.includes('@outlook') || lowerUser.includes('@hotmail')) {
      host = 'smtp.office365.com';
    } else {
      host = 'smtp.gmail.com';
    }
  }

  // Ensure domain suffix for Gmail and Yandex if user specified only username
  if (host.includes('gmail') && user && !user.includes('@')) {
    user = `${user}@gmail.com`;
  }
  if ((host.includes('yandex') || lowerUser.includes('yandex') || lowerUser.includes('ya.ru')) && user && !user.includes('@')) {
    user = `${user}@yandex.ru`;
  }

  const rawPort = (
    env.SMTP_PORT ||
    env.SMPT_PORT ||
    env.VITE_SMTP_PORT ||
    env.EMAIL_PORT ||
    env.MAIL_PORT ||
    ''
  ).toString().trim().replace(/^["']|["']$/g, '');

  let port = rawPort ? parseInt(rawPort, 10) : null;
  if (!port || isNaN(port)) {
    port = 465; // Default to secure SSL
  }

  const resendApiKey = (env.RESEND_API_KEY || env.RESEND_KEY || '').trim().replace(/^["']|["']$/g, '');

  return {
    user,
    pass,
    host,
    port,
    lowerUser: user.toLowerCase(),
    resendApiKey,
    detectedUserKey,
    detectedPassKey,
    hasUser: Boolean(user && user.length > 3),
    hasPass: Boolean(pass && pass.length >= 4),
  };
}

// Auto-run on import to ensure early initialization
initEnv();
