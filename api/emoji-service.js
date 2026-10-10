import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { safeFetch } from '../utils/url-validator.js';

const EMOJI_ALIASES_MAP = {
  // Aliases for missing categories or renamed emojis
  'smileys/fire.webp': 'Animals and Nature/Fire.webp',
  'smileys/red heart.webp': 'Symbols/Red Heart.webp',
  'smileys/eyes.webp': 'People/Eyes.webp',
  'smileys/cool.webp': 'Symbols/Cool Button.webp',
  'smileys/star-struck.webp': 'Smileys/Star Struck.webp',
  'smileys/star%20struck.webp': 'Smileys/Star Struck.webp',
  'smileys/smiling face with heart-eyes.webp': 'Smileys/Smiling Face With Hearts.webp',
  'smileys/smiling%20face%20with%20heart-eyes.webp': 'Smileys/Smiling Face With Hearts.webp',
  'objects/package.webp': 'Objects/Toolbox.webp',
  'objects/pen.webp': 'Objects/Pencil.webp',
  'objects/gear.webp': 'Objects/Toolbox.webp',
  'objects/gift.webp': 'Activity/Party Popper.webp',
  'objects/shield.webp': 'Objects/Locked With Key.webp',
  'objects/wastebasket.webp': 'Symbols/Cross Mark.webp',
  'objects/paperclip.webp': 'Objects/Memo.webp',
  'objects/envelope.webp': 'Objects/Incoming Envelope.webp',
  'objects/dvd.webp': 'Objects/Laptop.webp',
  'objects/crossed swords.webp': 'Activity/Military Medal.webp',
  'objects/crossed%20swords.webp': 'Activity/Military Medal.webp',
  'activity/game die.webp': 'Activity/Video Game.webp',
  'activity/game%20die.webp': 'Activity/Video Game.webp',
  'animals and nature/globe showing americas.webp': 'Travel and Places/Compass.webp',
  'animals and nature/globe%20showing%20americas.webp': 'Travel and Places/Compass.webp',
  'travel and places/rainbow.webp': 'Animals and Nature/Rainbow.webp',
  'symbols/back arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/back%20arrow.webp': 'Symbols/Top Arrow.webp',
  'symbols/counterclockwise arrows button.webp': 'Symbols/Currency Exchange.webp',
  'symbols/counterclockwise%20arrows%20button.webp': 'Symbols/Currency Exchange.webp',
  'symbols/stop sign.webp': 'Symbols/Cross Mark.webp',
  'symbols/stop%20sign.webp': 'Symbols/Cross Mark.webp',
  'flags/flag azerbaijan.webp': 'Flags/Triangular Flag.webp',
  'flags/flag georgia.webp': 'Flags/Triangular Flag.webp',
  'flags/flag kazakhstan.webp': 'Flags/Triangular Flag.webp',
  'flags/flag kyrgyzstan.webp': 'Flags/Triangular Flag.webp',
  'flags/flag moldova.webp': 'Flags/Triangular Flag.webp',
  'flags/flag turkey.webp': 'Flags/Triangular Flag.webp',
  'flags/flag united kingdom.webp': 'Flags/Triangular Flag.webp'
};

const POPULAR_EMOJIS = [
  'Activity/Sparkles.webp',
  'Activity/Party Popper.webp',
  'Activity/Trophy.webp',
  'Animals and Nature/Fire.webp',
  'Animals and Nature/Star.webp',
  'Animals and Nature/Glowing Star.webp',
  'Animals and Nature/Sun.webp',
  'Objects/Shopping Bags.webp',
  'Objects/Key.webp',
  'Objects/Laptop.webp',
  'Objects/Toolbox.webp',
  'Objects/Keyboard.webp',
  'Objects/Television.webp',
  'Objects/Crown.webp',
  'Objects/Gem Stone.webp',
  'People/Clapping Hands.webp',
  'People/Thumbs Up.webp',
  'People/Waving Hand.webp',
  'Smileys/Face With Tears Of Joy.webp',
  'Smileys/Grinning Face.webp',
  'Smileys/Smiling Face With Heart-Eyes.webp',
  'Smileys/Face Screaming In Fear.webp',
  'Smileys/Rolling On The Floor Laughing.webp',
  'Smileys/Face Blowing A Kiss.webp',
  'Smileys/Thinking Face.webp',
  'Smileys/Exploding Head.webp',
  'Smileys/Partying Face.webp',
  'Smileys/Cool.webp',
  'Smileys/Eyes.webp',
  'Smileys/Star-Struck.webp',
  'Smileys/Crying Face.webp',
  'Smileys/Skull.webp',
  'Smileys/Zzz.webp',
  'Symbols/Red Heart.webp',
  'Symbols/Counterclockwise Arrows Button.webp',
  'Travel and Places/Rocket.webp'
];

// In-memory LRU / Maps
const animatedCache = new Map();
const staticCache = new Map();
const fallbackWebpBuffer = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
const baseDiskDir = path.join(process.cwd(), 'public/emoji');

function computeETag(buffer, isStatic) {
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
  return `W/"${hash}-${isStatic ? 's' : 'a'}-${buffer.length}"`;
}

export function sanitizeEmojiPath(rawPath) {
  if (!rawPath) return '';
  let emojiPath = String(rawPath).trim()
    .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
    .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
    .replace(/^\/+/, '');

  try {
    emojiPath = decodeURIComponent(emojiPath);
  } catch {}

  // Prevent directory traversal
  emojiPath = emojiPath.replace(/\.\.+/g, '').replace(/[<>:"|?*]/g, '');

  const lowerKey = emojiPath.toLowerCase();
  if (EMOJI_ALIASES_MAP[lowerKey]) {
    emojiPath = EMOJI_ALIASES_MAP[lowerKey];
  }

  return emojiPath;
}

export async function fetchAnimatedEmojiBuffer(emojiPath) {
  // 1. Check in-memory cache
  if (animatedCache.has(emojiPath)) {
    return animatedCache.get(emojiPath);
  }

  // 2. Check local disk
  const localFilePath = path.join(baseDiskDir, emojiPath);
  if (fs.existsSync(localFilePath)) {
    try {
      const buffer = fs.readFileSync(localFilePath);
      animatedCache.set(emojiPath, buffer);
      return buffer;
    } catch (readErr) {
      console.warn('[emoji-service] Read error from disk:', readErr.message);
    }
  }

  // 3. Fetch from jsdelivr CDN mirror or GitHub raw fallback
  const encodedPath = encodeURI(emojiPath);
  const mirror = `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`;
  const rawGithub = `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`;

  try {
    let fetchRes = await safeFetch(mirror, {
      allowedDomains: ['cdn.jsdelivr.net', 'fastly.jsdelivr.net'],
      timeoutMs: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/webp,image/*,*/*'
      }
    });

    if (!fetchRes.ok) {
      // Fallback to GitHub raw
      fetchRes = await safeFetch(rawGithub, {
        allowedDomains: ['raw.githubusercontent.com'],
        timeoutMs: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'image/webp,image/*,*/*'
        }
      });
    }

    if (!fetchRes.ok) {
      return null;
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to memory cache
    animatedCache.set(emojiPath, buffer);

    // Save to disk asynchronously so subsequent hits are local and instant
    try {
      const dirName = path.dirname(localFilePath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(localFilePath, buffer);
    } catch (saveErr) {
      // Non-fatal if disk write fails
    }

    return buffer;
  } catch (err) {
    console.warn('[emoji-service] Fetch failed for', emojiPath, err.message);
    return null;
  }
}

export async function getStaticEmojiBuffer(emojiPath, animatedBuffer) {
  // 1. Check in-memory static cache
  if (staticCache.has(emojiPath)) {
    return staticCache.get(emojiPath);
  }

  // 2. Check local disk for .static.webp
  const staticPath = emojiPath.replace(/\.webp$/i, '.static.webp');
  const localStaticFile = path.join(baseDiskDir, staticPath);
  if (fs.existsSync(localStaticFile)) {
    try {
      const buffer = fs.readFileSync(localStaticFile);
      staticCache.set(emojiPath, buffer);
      return buffer;
    } catch (readErr) {}
  }

  // 3. Extract 1st frame with sharp (98% size reduction, zero animation CPU/GPU loop)
  try {
    const staticBuf = await sharp(animatedBuffer, { pages: 1 })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    staticCache.set(emojiPath, staticBuf);

    // Persist static file to disk
    try {
      const dirName = path.dirname(localStaticFile);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(localStaticFile, staticBuf);
    } catch (diskErr) {}

    return staticBuf;
  } catch (sharpErr) {
    console.warn('[emoji-service] Sharp static conversion failed for', emojiPath, sharpErr.message);
    return animatedBuffer; // Fallback to original buffer
  }
}

export async function handleEmojiRequest(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const rawPath = String(req.query?.path || req.query?.url || '').trim();
  const isStatic = String(req.query?.static || '').trim() === '1' || String(req.query?.static || '').trim() === 'true';

  if (!rawPath) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (typeof res.send === 'function') return res.status(200).send(fallbackWebpBuffer);
    res.statusCode = 200;
    return res.end(fallbackWebpBuffer);
  }

  const emojiPath = sanitizeEmojiPath(rawPath);
  if (!emojiPath) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (typeof res.send === 'function') return res.status(200).send(fallbackWebpBuffer);
    res.statusCode = 200;
    return res.end(fallbackWebpBuffer);
  }

  try {
    const animatedBuffer = await fetchAnimatedEmojiBuffer(emojiPath);
    if (!animatedBuffer) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (typeof res.send === 'function') return res.status(200).send(fallbackWebpBuffer);
      res.statusCode = 200;
      return res.end(fallbackWebpBuffer);
    }

    let targetBuffer = animatedBuffer;
    if (isStatic) {
      targetBuffer = await getStaticEmojiBuffer(emojiPath, animatedBuffer);
    }

    const etag = computeETag(targetBuffer, isStatic);
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Emoji-Mode', isStatic ? 'static-optimized' : 'animated-original');

    const ifNoneMatch = req.headers?.['if-none-match'];
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}`)) {
      res.statusCode = 304;
      return res.end();
    }

    if (typeof res.send === 'function') {
      return res.status(200).send(targetBuffer);
    }
    res.statusCode = 200;
    return res.end(targetBuffer);
  } catch (err) {
    console.error('[emoji-service] Handler error:', err.message);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (typeof res.send === 'function') return res.status(200).send(fallbackWebpBuffer);
    res.statusCode = 200;
    return res.end(fallbackWebpBuffer);
  }
}

// Background prewarm of top emojis so they are instantly cached on disk and in memory
export function prewarmTopEmojis() {
  setTimeout(async () => {
    for (const em of POPULAR_EMOJIS) {
      try {
        const animBuf = await fetchAnimatedEmojiBuffer(em);
        if (animBuf) {
          await getStaticEmojiBuffer(em, animBuf);
        }
      } catch (e) {
        // Ignore background prewarm errors
      }
    }
  }, 1000);
}

// Start pre-warm automatically
prewarmTopEmojis();
