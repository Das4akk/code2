// Vercel Serverless Function for Telegram Animated Emojis Proxy
const emojiMemoryCache = new Map();

// Fallback 1x1 transparent WebP image buffer
const fallbackWebp = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
  'base64'
);

const EMOJI_ALIASES = {
  'objects/pen.webp': 'Objects/Pencil.webp',
  'symbols/back arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/back%20arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/counterclockwise arrows button.webp': 'Symbols/Currency Exchange.webp',
  'symbols/counterclockwise%20arrows%20button.webp': 'Symbols/Currency Exchange.webp',
  'objects/wastebasket.webp': 'Symbols/Cross Mark.webp',
  'objects/paperclip.webp': 'Objects/Memo.webp',
  'objects/envelope.webp': 'Objects/Incoming Envelope.webp',
  'objects/package.webp': 'Objects/Toolbox.webp'
};

export default async function handler(req, res) {
  try {
    let rawPath = ((req.query.path || req.query.url || '') + '').trim();
    if (!rawPath) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fallbackWebp);
    }

    let emojiPath = rawPath
      .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
      .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
      .replace(/^\/+/, '');

    try {
      emojiPath = decodeURIComponent(emojiPath);
    } catch (e) {}

    const lowerKey = emojiPath.toLowerCase();
    if (EMOJI_ALIASES[lowerKey]) {
      emojiPath = EMOJI_ALIASES[lowerKey];
    }

    const encodedPath = encodeURI(emojiPath);
    const cacheKey = emojiPath;

    const cached = emojiMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 24 * 3600 * 1000) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(cached.buffer);
    }

    const mirrors = [
      `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://testingcf.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://fastly.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
      `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`,
      `https://cdn.statically.io/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`
    ];

    try {
      const fetchWinner = await Promise.any(
        mirrors.map(async (mirror) => {
          const fetchRes = await fetch(mirror, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!fetchRes.ok) throw new Error('Not ok: ' + fetchRes.status);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/webp';
          return { buffer: Buffer.from(arrayBuffer), contentType };
        })
      );

      if (emojiMemoryCache.size > 1000) {
        const firstKey = emojiMemoryCache.keys().next().value;
        if (firstKey) emojiMemoryCache.delete(firstKey);
      }
      emojiMemoryCache.set(cacheKey, {
        buffer: fetchWinner.buffer,
        contentType: fetchWinner.contentType,
        timestamp: Date.now()
      });

      res.setHeader('Content-Type', fetchWinner.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fetchWinner.buffer);
    } catch (e) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fallbackWebp);
    }
  } catch (err) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(fallbackWebp);
  }
}
