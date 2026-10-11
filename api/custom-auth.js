import { setCors } from './_lib/helpers/auth.js';
import * as customAuthHandler from './_lib/handlers/custom-auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

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

  // Parse body safely
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  // Extract action from query, body, or path
  const urlObj = new URL(req.url || '', 'http://localhost:3000');
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const pathAction = pathParts[pathParts.length - 1];

  let action = (req.query?.action || req.body?.action || '').trim();
  if (!action && pathAction && pathAction !== 'custom-auth' && pathAction !== 'api') {
    action = pathAction;
  }

  try {
    switch (action) {
      case 'send-code':
        return await customAuthHandler.sendCode(req, res);
      case 'verify-code':
        return await customAuthHandler.verifyCode(req, res);
      case 'reset-password':
        return await customAuthHandler.resetPassword(req, res);
      case 'change-email':
        return await customAuthHandler.changeEmail(req, res);
      case 'diag':
      case 'diagnostics':
      case 'health':
        return await customAuthHandler.getDiagnostics(req, res);
      default:
        // Default to send-code if email is present
        if (req.body?.email || req.query?.email) {
          return await customAuthHandler.sendCode(req, res);
        }
        return res.status(404).json({ error: `Unknown custom-auth action: ${action}` });
    }
  } catch (err) {
    console.error('[API /api/custom-auth error]:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
