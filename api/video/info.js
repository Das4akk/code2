import { getVideoInfo } from '../video-service.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.query?.url || req.body?.url || '';

  if (!url || !String(url).trim()) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

  try {
    const data = await getVideoInfo(String(url).trim());
    return res.status(200).json(data);
  } catch (err) {
    console.error('[API /api/video/info error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
