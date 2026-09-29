import { getVideoInfo } from '../video-service.js';
import { validateUrl } from '../../utils/url-validator.js';

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://cowio.vercel.app',
    'https://cowio.ru',
    'https://www.cowio.ru',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.query?.url || req.body?.url || '';

  if (!url || !String(url).trim()) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

  // SSRF protection check
  const validation = await validateUrl(String(url).trim());
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error || 'Blocked by SSRF filter'
    });
  }

  try {
    const data = await getVideoInfo(String(url).trim());
    if (!data || !data.success) {
      return res.status(400).json(data || { success: false, error: 'Failed to retrieve video metadata' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('[API /api/video/info error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
