import { setCors } from './_lib/helpers/auth.js';
import * as adminHandler from './_lib/handlers/admin.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      if (segments.length > 1 && segments[0] === 'admin') {
        action = segments[segments.length - 1];
      }
    }

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    switch (action) {
      case 'recalc-leaderboard':
        return await adminHandler.recalcLeaderboard(req, res);
      case 'update-user-field':
        return await adminHandler.updateUserField(req, res);
      default:
        return res.status(404).json({ error: `Unknown admin action: ${action}` });
    }
  } catch (err) {
    console.error('[admin router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
