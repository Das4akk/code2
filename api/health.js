import { setCors } from './_lib/helpers/auth.js';
import { getDiagnostics } from './_lib/handlers/custom-auth.js';

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

  try {
    return await getDiagnostics(req, res);
  } catch (err) {
    console.error('[API /api/health error]:', err);
    return res.status(200).json({
      status: 'degraded',
      error: err.message,
      timestamp: Date.now()
    });
  }
}
