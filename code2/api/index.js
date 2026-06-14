import app from '../server.js';

/** Vercel rewrites change req.url to /api/index.js — restore the real path for Express. */
function restoreOriginalUrl(req) {
    const raw =
        req.headers['x-vercel-original-url'] ||
        req.headers['x-original-url'] ||
        req.headers['x-forwarded-uri'] ||
        req.headers['x-invoke-path'];
    if (typeof raw !== 'string' || !raw.length) return;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const u = new URL(raw);
        req.url = u.pathname + u.search;
    } else {
        req.url = raw.startsWith('/') ? raw : `/${raw}`;
    }
}

export default function handler(req, res) {
    restoreOriginalUrl(req);
    return app(req, res);
}
