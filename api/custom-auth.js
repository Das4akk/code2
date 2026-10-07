import { setCors } from './_lib/helpers/auth.js';
import * as customAuthHandler from './_lib/handlers/custom-auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== 'custom-auth' && last !== 'api') {
        action = last;
      }
    }

    switch (action) {
      case 'send-code':
        return await customAuthHandler.sendCode(req, res);
      case 'verify-code':
        return await customAuthHandler.verifyCode(req, res);
      case 'reset-password':
        return await customAuthHandler.resetPassword(req, res);
      case 'change-email':
        return await customAuthHandler.changeEmail(req, res);
      default:
        return res.status(404).json({ error: `Unknown custom-auth action: ${action}` });
    }
  } catch (err) {
    console.error('[custom-auth router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
