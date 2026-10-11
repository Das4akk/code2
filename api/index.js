import { setCors } from './_lib/helpers/auth.js';
import { initEnv } from './_lib/helpers/env.js';
import * as customAuthHandler from './_lib/handlers/custom-auth.js';

// Pre-load and normalize environment variables at module initialization
initEnv();

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Polyfill status and json methods for serverless compatibility
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

  // Safe body parsing: Vercel's @vercel/node runtime parses req.body before invocation
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  // Parse URL & Query params
  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'http://localhost:3000');
  let pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
  
  if (!req.query) {
    req.query = Object.fromEntries(urlObj.searchParams.entries());
  } else {
    for (const [k, v] of urlObj.searchParams.entries()) {
      if (req.query[k] === undefined) req.query[k] = v;
    }
  }

  // Vercel rewrite resolution:
  // When vercel.json rewrites /api/(.*) -> /api/index.js,
  // req.url may simply be '/api/index.js' or '/api'.
  // We resolve the true requested path from headers or __route query parameter.
  if (req.query?.__route) {
    pathname = '/api/' + String(req.query.__route).replace(/^\/+/, '').split('?')[0];
  } else if (req.headers && req.headers['x-matched-path']) {
    pathname = String(req.headers['x-matched-path']).split('?')[0];
  } else if (req.headers && req.headers['x-forwarded-uri']) {
    pathname = String(req.headers['x-forwarded-uri']).split('?')[0];
  } else if (req.headers && req.headers['x-invoke-path']) {
    pathname = String(req.headers['x-invoke-path']).split('?')[0];
  }

  // Clean trailing slashes
  pathname = pathname.replace(/\/+$/, '') || '/';

  // If the path is still /api/index.js, /api/index, /api, or root /:
  // Route intelligently using the action query/body parameter
  const actionParam = (req.query?.action || req.body?.action || '').trim();
  if (
    pathname === '/api/index.js' ||
    pathname === '/api/index' ||
    pathname === '/api' ||
    pathname === '/'
  ) {
    if (actionParam === 'send-code' || actionParam === 'verify-code' || actionParam === 'reset-password' || actionParam === 'change-email') {
      pathname = `/api/custom-auth/${actionParam}`;
    } else if (actionParam === 'health' || actionParam === 'diag' || actionParam === 'diagnostics') {
      pathname = '/api/health';
    } else if (actionParam === 'resolve-media') {
      pathname = '/api/resolve-media';
    } else if (req.query?.endpoint || req.body?.endpoint) {
      pathname = '/api/' + String(req.query?.endpoint || req.body?.endpoint).replace(/^\/+/, '');
    }
  }

  // Helper to extract action from query, body, or pathname
  const getSubAction = (prefix) => {
    let act = (req.query?.action || req.body?.action || '').trim();
    if (!act && pathname.startsWith(prefix)) {
      const sub = pathname.slice(prefix.length).replace(/^\/+/, '').split('/')[0];
      if (sub) act = sub.trim();
    }
    return act;
  };

  try {
    // 1. Diagnostics & Health
    if (pathname === '/api/health' || pathname === '/api/diag' || pathname === '/api/custom-auth/diag') {
      return await customAuthHandler.getDiagnostics(req, res);
    }

    // 2. Custom Auth (send-code, verify-code, reset-password, change-email)
    if (pathname.startsWith('/api/custom-auth')) {
      const action = getSubAction('/api/custom-auth');
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
          return await customAuthHandler.getDiagnostics(req, res);
        default:
          return res.status(404).json({ error: `Unknown custom-auth action: ${action}` });
      }
    }

    // 3. Resolve Media
    if (pathname === '/api/resolve-media') {
      const videoHandler = await import('./_lib/handlers/video.js');
      return await videoHandler.resolveMedia(req, res);
    }

    // 4. Video & Library
    if (pathname.startsWith('/api/video') || pathname.startsWith('/api/library')) {
      const videoHandler = await import('./_lib/handlers/video.js');
      const prefix = pathname.startsWith('/api/video') ? '/api/video' : '/api/library';
      const action = getSubAction(prefix);
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
          if (req.query?.url || req.body?.url) {
            return await videoHandler.info(req, res);
          }
          return res.status(404).json({ error: `Unknown video action: ${action}` });
      }
    }

    // 5. Auth
    if (pathname.startsWith('/api/auth')) {
      const authHandler = await import('./_lib/handlers/auth.js');
      const action = getSubAction('/api/auth') || 'check-role';
      switch (action) {
        case 'check-role':
          return await authHandler.checkRole(req, res);
        case 'claim-role':
          return await authHandler.claimRole(req, res);
        case 'geo':
          return await authHandler.geo(req, res);
        default:
          return res.status(404).json({ error: `Unknown auth action: ${action}` });
      }
    }

    // 6. Admin
    if (pathname.startsWith('/api/admin')) {
      const adminHandler = await import('./_lib/handlers/admin.js');
      const action = getSubAction('/api/admin');
      switch (action) {
        case 'recalc-leaderboard':
          return await adminHandler.recalcLeaderboard(req, res);
        case 'update-user-field':
          return await adminHandler.updateUserField(req, res);
        case 'set-user-role':
          return await adminHandler.setUserRole(req, res);
        case 'set-maintenance':
          return await adminHandler.setMaintenance(req, res);
        default:
          return res.status(404).json({ error: `Unknown admin action: ${action}` });
      }
    }

    // 7. Users
    if (pathname.startsWith('/api/users')) {
      const usersHandler = await import('./_lib/handlers/users.js');
      const action = getSubAction('/api/users') || 'search';
      switch (action) {
        case 'search':
          return await usersHandler.search(req, res);
        case 'send-tip':
        case 'tip':
          return await usersHandler.sendTip(req, res);
        default:
          return res.status(404).json({ error: `Unknown users action: ${action}` });
      }
    }

    // 8. Chat
    if (pathname.startsWith('/api/chat')) {
      const chatHandler = await import('./_lib/handlers/chat.js');
      const action = getSubAction('/api/chat') || 'send-message';
      switch (action) {
        case 'send-message':
        case 'message':
          return await chatHandler.sendMessage(req, res);
        default:
          return res.status(404).json({ error: `Unknown chat action: ${action}` });
      }
    }

    // 9. Premium
    if (pathname.startsWith('/api/premium')) {
      const premiumHandler = await import('./_lib/handlers/premium.js');
      const action = getSubAction('/api/premium');
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
    }

    return res.status(404).json({ error: `API route not found: ${pathname}` });
  } catch (err) {
    console.error('[Unified API Router Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
