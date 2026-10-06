import { setCors } from './_lib/helpers/auth.js';
import * as authHandler from './_lib/handlers/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      if (segments.length > 1 && segments[0] === 'auth') {
        action = segments[segments.length - 1];
      }
    }

    if (!action || action === 'check-role') {
      return await authHandler.checkRole(req, res);
    }

    switch (action) {
      case 'check-role':
        return await authHandler.checkRole(req, res);
      case 'geo':
        return await authHandler.geo(req, res);
      default:
        return res.status(404).json({ error: `Unknown auth action: ${action}` });
    }
  } catch (err) {
    console.error('[auth router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
