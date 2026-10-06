import { getVideoInfo, searchVideos } from '../video-service.js';
import { validateUrl, safeFetch } from '../../utils/url-validator.js';
import { setCors } from '../helpers/auth.js';

export async function info(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query?.url || req.body?.url || '';
  if (!url || !String(url).trim()) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

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
    console.error('[API /api/video info error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function search(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = ((req.query?.q || req.query?.query || req.body?.q || req.body?.query || '')).trim();
  const platform = ((req.query?.platform || req.body?.platform || 'all')).trim();

  if (!q) return res.status(200).json({ success: true, results: [] });

  try {
    const results = await searchVideos(q, platform);
    return res.status(200).json(results);
  } catch (err) {
    console.error('[API /api/video search error]:', err);
    return res.status(500).json({ success: false, error: 'Video search error', results: [] });
  }
}

export async function resolveMedia(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = ((req.body?.url || req.query?.url || '')).trim();
  if (!url) return res.status(400).json({ success: false, error: 'url required' });

  const validation = await validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || 'Blocked by SSRF filter' });
  }

  try {
    const data = await getVideoInfo(url);
    if (!data || !data.success) {
      return res.status(400).json({ success: false, error: 'Could not resolve media' });
    }
    return res.status(200).json({
      success: true,
      source: data.url || url,
      title: data.title || '',
      duration: 0,
      thumbnail: data.thumbnail || '',
      platform: data.platform || 'unknown',
      isHls: /\.m3u8/i.test(data.url || url),
      ext: data.platform || '',
      resolvedAt: Date.now()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Media resolution error' });
  }
}

export async function fetchMetadata(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.body || req.query || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'No URL provided' });
  }

  const trimmedUrl = url.trim();
  const validation = await validateUrl(trimmedUrl);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || 'Invalid or forbidden URL' });
  }

  let videoId = '';
  try {
    if (trimmedUrl.includes('youtube.com/watch')) {
      videoId = new URL(trimmedUrl).searchParams.get('v') || '';
    } else if (trimmedUrl.includes('youtu.be/')) {
      videoId = trimmedUrl.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (trimmedUrl.includes('youtube.com/embed/')) {
      videoId = trimmedUrl.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    }
  } catch {}

  let title = 'Без названия';
  let description = '';
  let authorName = '';
  let authorAvatar = '';

  if (videoId) {
    try {
      const oembedRes = await safeFetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { timeoutMs: 4000 }
      );
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title || title;
        authorName = data.author_name || authorName;
        authorAvatar = data.thumbnail_url || authorAvatar;
      }
    } catch {}

    try {
      const fetchRes = await safeFetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeoutMs: 4000
      });
      if (fetchRes.ok) {
        const html = await fetchRes.text();
        const descMatch =
          html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
          html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
        if (descMatch && descMatch[1]) {
          description = descMatch[1].trim();
        }
      }
    } catch {}
  } else {
    try {
      const infoData = await getVideoInfo(trimmedUrl);
      if (infoData && infoData.success) {
        title = infoData.title || title;
        authorName = infoData.author || authorName;
        authorAvatar = infoData.thumbnail || authorAvatar;
        description = infoData.description || description;
      }
    } catch {}
  }

  return res.status(200).json({
    success: true,
    title,
    description,
    authorName,
    authorAvatar
  });
}
