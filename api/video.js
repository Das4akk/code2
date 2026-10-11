import { setCors } from './_lib/helpers/auth.js';
import * as videoHandler from './_lib/handlers/video.js';

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

  // Safe body parsing
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  // Parse query from URL if missing
  const urlObj = new URL(req.url || '', 'http://localhost:3000');
  if (!req.query) {
    req.query = Object.fromEntries(urlObj.searchParams.entries());
  } else {
    for (const [k, v] of urlObj.searchParams.entries()) {
      if (req.query[k] === undefined) req.query[k] = v;
    }
  }

  // Determine action
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const pathAction = pathParts[pathParts.length - 1];

  let action = (req.query?.action || req.body?.action || '').trim();
  if (!action && pathAction && pathAction !== 'video' && pathAction !== 'api') {
    action = pathAction;
  }

  try {
    switch (action) {
      case 'search':
        return await videoHandler.search(req, res);
      case 'info':
        return await videoHandler.info(req, res);
      case 'resolve-media':
        return await videoHandler.resolveMedia(req, res);
      case 'fetch-metadata':
        return await videoHandler.fetchMetadata(req, res);
      default:
        if (req.query?.q || req.body?.q || req.query?.query || req.body?.query) {
          return await videoHandler.search(req, res);
        }
        if (req.query?.url || req.body?.url) {
          return await videoHandler.info(req, res);
        }
        return res.status(404).json({ error: `Unknown video action: ${action}` });
    }
  } catch (err) {
    console.error('[API /api/video error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error', results: [] });
  }
}
