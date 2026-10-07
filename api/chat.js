import { setCors } from './_lib/helpers/auth.js';
import * as chatHandler from './_lib/handlers/chat.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== 'chat' && last !== 'api') {
        action = last;
      }
    }

    if (!action || action === 'send-message') {
      return await chatHandler.sendMessage(req, res);
    }

    switch (action) {
      case 'send-message':
        return await chatHandler.sendMessage(req, res);
      default:
        return res.status(404).json({ error: `Unknown chat action: ${action}` });
    }
  } catch (err) {
    console.error('[chat router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
