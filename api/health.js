import { setCors } from './_lib/helpers/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    app: 'COWIO',
    env: process.env.NODE_ENV || 'production'
  });
}
