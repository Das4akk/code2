import { setCors } from './_lib/helpers/auth.js';
import { safeFetch } from '../utils/url-validator.js';

const EMOJI_ALIASES_MAP = {
  'objects/package.webp': 'Objects/Toolbox.webp'
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let rawPath = String(req.query?.path || req.query?.url || '').trim();
    if (!rawPath) {
      return res.status(400).json({ error: 'Missing path or url parameter' });
    }

    let emojiPath = rawPath
      .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
      .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
      .replace(/^\/+/, '');

    try {
      emojiPath = decodeURIComponent(emojiPath);
    } catch {}

    const lowerKey = emojiPath.toLowerCase();
    if (EMOJI_ALIASES_MAP[lowerKey]) {
      emojiPath = EMOJI_ALIASES_MAP[lowerKey];
    }

    const encodedPath = encodeURI(emojiPath);
    const mirror = `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`;

    const fetchRes = await safeFetch(mirror, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/webp,image/*,*/*'
      },
      timeoutMs: 8000
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status || 502).json({ error: 'Failed to fetch emoji' });
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[emoji-proxy error]:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
