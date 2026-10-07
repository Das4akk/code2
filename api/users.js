import { setCors } from './_lib/helpers/auth.js';
import * as usersHandler from './_lib/handlers/users.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== 'users' && last !== 'api') {
        action = last;
      }
    }

    if (!action || action === 'search') {
      return await usersHandler.search(req, res);
    }

    switch (action) {
      case 'search':
        return await usersHandler.search(req, res);
      default:
        return res.status(404).json({ error: `Unknown users action: ${action}` });
    }
  } catch (err) {
    console.error('[users router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
