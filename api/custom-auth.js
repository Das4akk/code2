import { setCors } from './_lib/helpers/auth.js';
import { initEnv } from './_lib/helpers/env.js';
import {
  sendCode,
  verifyCode,
  resetPassword,
  changeEmail,
  getDiagnostics
} from './_lib/handlers/custom-auth.js';

// Pre-load and normalize environment variables
initEnv();

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Polyfill status and json methods
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  // Parse body
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  // Parse URL & Query
  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'http://localhost:3000');
  if (!req.query) {
    req.query = Object.fromEntries(urlObj.searchParams.entries());
  } else {
    for (const [k, v] of urlObj.searchParams.entries()) {
      if (req.query[k] === undefined) req.query[k] = v;
    }
  }

  // Determine subaction:
  // 1. From query ?action=...
  // 2. From body { action: ... }
  // 3. From path: e.g. /api/custom-auth/send-code -> 'send-code'
  let action = (req.query?.action || req.body?.action || '').trim().toLowerCase();

  if (!action) {
    const rawPath =
      req.headers?.['x-matched-path'] ||
      req.headers?.['x-forwarded-uri'] ||
      req.headers?.['x-invoke-path'] ||
      urlObj.pathname ||
      '';
    const cleanPath = String(rawPath).split('?')[0].replace(/\/+$/, '');
    const parts = cleanPath.split('/');
    const lastPart = (parts[parts.length - 1] || '').trim().toLowerCase();
    if (lastPart && !['custom-auth', 'custom-auth.js', 'index.js', 'api'].includes(lastPart)) {
      action = lastPart;
    }
  }

  // If still no action specified, infer from presence of fields
  if (!action) {
    if (req.body?.email && !req.body?.code) {
      action = 'send-code';
    } else if (req.body?.email && req.body?.code) {
      action = 'verify-code';
    } else if (req.body?.newPassword) {
      action = 'reset-password';
    } else if (req.body?.newEmail) {
      action = 'change-email';
    } else {
      action = 'send-code';
    }
  }

  try {
    switch (action) {
      case 'send-code':
        return await sendCode(req, res);
      case 'verify-code':
        return await verifyCode(req, res);
      case 'reset-password':
        return await resetPassword(req, res);
      case 'change-email':
        return await changeEmail(req, res);
      case 'diag':
      case 'diagnostics':
      case 'health':
        return await getDiagnostics(req, res);
      default:
        return res.status(404).json({ error: `Unknown custom-auth action: ${action}` });
    }
  } catch (err) {
    console.error('[custom-auth endpoint error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
}
