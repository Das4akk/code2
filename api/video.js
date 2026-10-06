import { setCors } from './_lib/helpers/auth.js';
import * as videoHandler from './_lib/handlers/video.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let action = (req.query?.action || req.body?.action || '').trim();
    if (!action) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      if (segments.length > 1 && (segments[0] === 'video' || segments[0] === 'library')) {
        action = segments[segments.length - 1];
      }
    }

    switch (action) {
      case 'info':
        return await videoHandler.info(req, res);
      case 'search':
        return await videoHandler.search(req, res);
      case 'resolve-media':
        return await videoHandler.resolveMedia(req, res);
      case 'fetch-metadata':
        return await videoHandler.fetchMetadata(req, res);
      default:
        // Default to info if url is passed directly
        if (req.query?.url || req.body?.url) {
          return await videoHandler.info(req, res);
        }
        return res.status(404).json({ error: `Unknown video action: ${action}` });
    }
  } catch (err) {
    console.error('[video router]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
