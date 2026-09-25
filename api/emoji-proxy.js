// Vercel Serverless Function for Telegram Animated Emojis Proxy
export default async function handler(req, res) {
  try {
    let emojiPath = ((req.query.path || req.query.url || '') + '').trim();
    if (!emojiPath) {
      return res.status(400).send('path required');
    }

    emojiPath = emojiPath.replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '');
    emojiPath = emojiPath.replace(/^Telegram-Animated-Emojis\/(main\/)?/, '');
    emojiPath = emojiPath.replace(/^\/+/, '');

    const mirrors = [
      `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${emojiPath}`,
      `https://testingcf.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${emojiPath}`,
      `https://fastly.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${emojiPath}`,
      `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${emojiPath}`
    ];

    try {
      const fetchWinner = await Promise.any(
        mirrors.map(async (mirror) => {
          const fetchRes = await fetch(mirror, {
            signal: AbortSignal.timeout(2000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!fetchRes.ok) throw new Error('Not ok: ' + fetchRes.status);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/webp';
          return { buffer: Buffer.from(arrayBuffer), contentType };
        })
      );

      res.setHeader('Content-Type', fetchWinner.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(fetchWinner.buffer);
    } catch (e) {
      return res.status(404).send('Emoji not found');
    }
  } catch (err) {
    return res.status(500).send('Error loading emoji: ' + err.message);
  }
}
