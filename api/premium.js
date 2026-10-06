import { setCors } from './_lib/helpers/auth.js';
import * as premiumHandler from './_lib/handlers/premium.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      if (segments.length > 1 && segments[0] === 'premium') {
        action = segments[segments.length - 1];
      }
    }

    switch (action) {
      case 'create-payment':
        return await premiumHandler.createPayment(req, res);
      case 'status':
        return await premiumHandler.status(req, res);
      case 'webhook':
        return await premiumHandler.webhook(req, res);
      default:
        return res.status(404).json({ error: `Unknown premium action: ${action}` });
    }
  } catch (err) {
    console.error('[premium router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
