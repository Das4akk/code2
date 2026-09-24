import { searchVideos } from '../video-service.js';

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

  const q = req.query?.q || req.query?.query || req.body?.q || req.body?.query || '';
  const platform = req.query?.platform || req.body?.platform || 'all';

  if (!q || !String(q).trim()) {
    return res.status(200).json({ success: true, results: [] });
  }

  try {
    const data = await searchVideos(String(q).trim(), platform);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[API /api/video/search error]:', err);
    return res.status(500).json({ success: false, error: err.message, results: [] });
  }
}
