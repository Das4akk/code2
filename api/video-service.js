import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function decodeHtml(str = '') {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function formatSeconds(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  if (sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${s}`;
  }
  return `${m}:${s}`;
}

// Priority Rutube Channels requested by user:
// 1) 32869212: https://rutube.ru/channel/32869212/ ("Смотри кино!")
// 2) 32181632: https://rutube.ru/channel/32181632/ ("Фильмач — фильмы и сериалы онлайн")
const PRIORITY_CHANNEL_IDS = ['32869212', '32181632'];

// In-memory catalog of priority channel videos
let priorityCatalog = [];
const priorityCatalogById = new Map();

// In-memory cache of recent search results to instantly resolve rich metadata
const recentSearchCache = new Map();
function rememberSearchItem(item) {
  if (!item || !item.url) return;
  recentSearchCache.set(item.url, item);
  if (item.id) recentSearchCache.set(item.id, item);
  const norm = item.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  recentSearchCache.set(norm, item);

  if (recentSearchCache.size > 1000) {
    const firstKey = recentSearchCache.keys().next().value;
    recentSearchCache.delete(firstKey);
  }
}

function loadPriorityCatalog() {
  try {
    const jsonPath = path.join(__dirname, 'rutube_priority_channels.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(data)) {
        priorityCatalog = data;
        priorityCatalogById.clear();
        for (const item of priorityCatalog) {
          if (item.id) priorityCatalogById.set(item.id, item);
          if (item.url) priorityCatalogById.set(item.url, item);
        }
        console.log(`[Rutube] Loaded ${priorityCatalog.length} priority channel videos into catalog.`);
      }
    }
  } catch (err) {
    console.warn('[Rutube] Failed to load priority channels catalog:', err.message);
  }
}

// Initial load
loadPriorityCatalog();

// Background sync for newly uploaded videos on these channels
export async function syncPriorityChannels() {
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
  };

  for (const chId of PRIORITY_CHANNEL_IDS) {
    try {
      const res = await fetch(`https://rutube.ru/api/video/person/${chId}/?page=1&format=json`, {
        headers: browserHeaders,
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results || [];
      let added = 0;
      for (const item of results) {
        if (!item || !item.id || priorityCatalogById.has(item.id)) continue;
        let dur = '';
        if (item.duration) {
          dur = formatSeconds(item.duration);
        }
        const vObj = {
          id: item.id,
          platform: 'rutube',
          platformLabel: 'Rutube',
          title: decodeHtml(item.title || ''),
          url: item.video_url || `https://rutube.ru/video/${item.id}/`,
          thumbnail: item.thumbnail_url || (item.picture_thumbnail ? item.picture_thumbnail.replace('{width}x{height}', '640x360') : ''),
          author: decodeHtml(item.author?.name || (chId === '32869212' ? 'Смотри кино!' : 'Фильмач')),
          authorAvatar: item.author?.avatar_url || '',
          duration: dur
        };
        priorityCatalog.unshift(vObj);
        priorityCatalogById.set(vObj.id, vObj);
        if (vObj.url) priorityCatalogById.set(vObj.url, vObj);
        added++;
      }
      if (added > 0) {
        console.log(`[Rutube] Synced ${added} new videos from channel ${chId}`);
      }
    } catch (e) {
      // ignore transient network errors during background sync
    }
  }
}

// Run sync after server starts, and periodically every 30 minutes
const initialSync = setTimeout(() => {
  syncPriorityChannels().catch(() => {});
}, 3000);
if (initialSync.unref) initialSync.unref();

const syncInterval = setInterval(() => {
  syncPriorityChannels().catch(() => {});
}, 30 * 60 * 1000);
if (syncInterval.unref) syncInterval.unref();

export async function getVideoInfo(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Empty URL' };
  }
  const trimmed = url.trim();

  // Instant check in recent search cache (guaranteed 100% correct metadata for clicked items)
  const normUrl = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cached = recentSearchCache.get(trimmed) || recentSearchCache.get(normUrl);
  if (cached) {
    return {
      success: true,
      title: cached.title,
      author: cached.author || cached.platformLabel || 'Видео',
      authorAvatar: cached.authorAvatar || '',
      thumbnail: cached.thumbnail || '',
      duration: cached.duration || '',
      platform: cached.platform || 'unknown',
      platformLabel: cached.platformLabel || 'Видео',
      url: cached.url || trimmed
    };
  }

  // 1. YouTube
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    try {
      let watchUrl = trimmed;
      const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      const ytId = shortsMatch?.[1] || embedMatch?.[1] || shortMatch?.[1] || watchMatch?.[1];
      if (ytId) {
        watchUrl = `https://www.youtube.com/watch?v=${ytId}`;
      }

      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, {
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        const title = decodeHtml(data.title);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(data.author_name || 'YouTube'),
            thumbnail: data.thumbnail_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ''),
            platform: 'youtube',
            platformLabel: 'YouTube',
            url: watchUrl
          };
        }
      }

      // Fallback: Scrape YouTube page
      const pageRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: AbortSignal.timeout(4500)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) ||
                           html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                           html.match(/<title>([^<]*)<\/title>/i);
        let title = titleMatch ? decodeHtml(titleMatch[1].replace(/- YouTube$/i, '')) : '';
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(authorMatch ? authorMatch[1] : 'YouTube'),
            thumbnail: imgMatch ? imgMatch[1] : (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ''),
            platform: 'youtube',
            platformLabel: 'YouTube',
            url: watchUrl
          };
        }
      }
    } catch (err) {
      console.warn('[VideoInfo] YouTube extraction error:', err.message);
    }
  }

  // 2. Rutube
  if (/rutube\.ru/i.test(trimmed)) {
    // Check if it's already in our priority channels catalog
    const idMatch = trimmed.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/i);
    const rtId = idMatch?.[1];
    if (rtId && priorityCatalogById.has(rtId)) {
      const cached = priorityCatalogById.get(rtId);
      return {
        success: true,
        title: cached.title,
        author: cached.author,
        authorAvatar: cached.authorAvatar,
        thumbnail: cached.thumbnail,
        platform: 'rutube',
        platformLabel: 'Rutube',
        url: cached.url || trimmed
      };
    }
    if (priorityCatalogById.has(trimmed)) {
      const cached = priorityCatalogById.get(trimmed);
      return {
        success: true,
        title: cached.title,
        author: cached.author,
        authorAvatar: cached.authorAvatar,
        thumbnail: cached.thumbnail,
        platform: 'rutube',
        platformLabel: 'Rutube',
        url: cached.url || trimmed
      };
    }

    try {
      const oembedRes = await fetch(`https://rutube.ru/api/oembed/?url=${encodeURIComponent(trimmed)}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        const title = decodeHtml(data.title);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(data.author_name || 'Rutube'),
            thumbnail: data.thumbnail_url || '',
            platform: 'rutube',
            platformLabel: 'Rutube',
            url: trimmed
          };
        }
      }

      if (rtId) {
        const apiRes = await fetch(`https://rutube.ru/api/video/${rtId}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(4500)
        });
        if (apiRes.ok) {
          const vData = await apiRes.json();
          if (vData.title) {
            return {
              success: true,
              title: decodeHtml(vData.title),
              author: decodeHtml(vData.author?.name || 'Rutube'),
              authorAvatar: vData.author?.avatar_url || '',
              thumbnail: vData.thumbnail_url || '',
              platform: 'rutube',
              platformLabel: 'Rutube',
              url: trimmed
            };
          }
        }
      }
    } catch (err) {
      console.warn('[VideoInfo] Rutube extraction error:', err.message);
    }
  }

  // 3. Vimeo
  if (/vimeo\.com/i.test(trimmed)) {
    try {
      const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(trimmed)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        return {
          success: true,
          title: decodeHtml(data.title || 'Vimeo Video'),
          author: decodeHtml(data.author_name || 'Vimeo'),
          thumbnail: data.thumbnail_url || '',
          platform: 'vimeo',
          platformLabel: 'Vimeo',
          url: trimmed
        };
      }
    } catch (err) {
      console.warn('[VideoInfo] Vimeo extraction error:', err.message);
    }
  }

  // 4. VK Video
  if (/vk\.com|vkvideo\.ru|vk\.ru/i.test(trimmed)) {
    let clean = trimmed;
    const iframeSrc = clean.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeSrc) clean = iframeSrc[1];

    let oid = null;
    let vid = null;
    let hash = null;

    if (/video_ext\.php/i.test(clean)) {
      const mOid = clean.match(/[?&]oid=(-?\d+)/i);
      const mId = clean.match(/[?&]id=([A-Za-z0-9]+)/i);
      const mHash = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (mOid) oid = mOid[1];
      if (mId) vid = mId[1];
      if (mHash) hash = mHash[1];
    }

    if (!oid || !vid) {
      const vMatch = clean.match(/(?:video|clip)(-?\d+)_([A-Za-z0-9]+)/i);
      if (vMatch) {
        oid = vMatch[1];
        vid = vMatch[2];
      }
    }

    if (!oid || !vid) {
      const zMatch = clean.match(/[?&]z=video(-?\d+)_([A-Za-z0-9]+)/i);
      if (zMatch) {
        oid = zMatch[1];
        vid = zMatch[2];
      }
    }

    if (!hash) {
      const hashMatch = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (hashMatch) hash = hashMatch[1];
    }

    let title = 'VK Video';
    let author = 'VK Video';
    let thumbnail = '';

    // Try to fetch metadata from mobile or desktop endpoint if possible
    try {
      const targetUrl = oid && vid ? `https://m.vk.com/video${oid}_${vid}` : clean;
      const pageRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: AbortSignal.timeout(3500)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                           html.match(/<title>([^<]*)<\/title>/i);
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        const hashMatch = html.match(/hash=([a-zA-Z0-9]+)/i) || html.match(/"hash":"([a-zA-Z0-9]+)"/i);
        if (!hash && hashMatch) hash = hashMatch[1];
        if (titleMatch) {
          const rawTitle = decodeHtml(titleMatch[1].replace(/\|\s*ВКонтакте$/i, '').trim());
          if (rawTitle && !/^(VK\.com|ВКонтакте)$/i.test(rawTitle)) title = rawTitle;
        }
        if (imgMatch) thumbnail = imgMatch[1];
      }
    } catch (err) {
      // ignore
    }

    let embedUrl = oid && vid
      ? `https://vk.com/video_ext.php?oid=${oid}&id=${vid}${hash ? `&hash=${hash}` : ''}&hd=2&autoplay=1&js_api=1`
      : clean;
    if (!embedUrl.includes('js_api=')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'js_api=1&autoplay=1&hd=2';
    }

    return {
      success: true,
      title: title || 'VK Video',
      author: author || 'VK Video',
      thumbnail: thumbnail || '',
      platform: 'vk',
      platformLabel: 'VK Video',
      url: embedUrl,
      directUrl: clean,
      oid,
      vid,
      hash
    };
  }

  // 5. Twitch
  if (/twitch\.tv/i.test(trimmed)) {
    const channelMatch = trimmed.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    const channel = channelMatch ? channelMatch[1] : 'Twitch';
    return {
      success: true,
      title: `Стрим ${channel}`,
      author: channel,
      thumbnail: '',
      platform: 'twitch',
      platformLabel: 'Twitch',
      url: trimmed
    };
  }

  // 6. Direct file / HLS m3u8
  if (/\.(mp4|webm|ogg|m3u8|mpd)(\?.*)?$/i.test(trimmed)) {
    const filename = trimmed.split('/').pop().split('?')[0] || 'Видео файл';
    return {
      success: true,
      title: decodeURIComponent(filename),
      author: 'Direct URL',
      thumbnail: '',
      platform: 'direct',
      platformLabel: 'Прямая ссылка',
      url: trimmed
    };
  }

  return {
    success: true,
    title: 'Видео',
    author: 'Интернет',
    thumbnail: '',
    platform: 'unknown',
    platformLabel: 'Видео',
    url: trimmed
  };
}

export function parseSearchQuery(rawQuery = '') {
  let q = String(rawQuery || '').trim();

  // Normalize S01E02 or 1x02 into "1 сезон 2 серия"
  q = q.replace(/s(\d{1,2})\s*e(\d{1,2})/giu, (_, s, e) => `${parseInt(s, 10)} сезон ${parseInt(e, 10)} серия`);
  q = q.replace(/(\d{1,2})\s*x\s*(\d{1,2})/giu, (_, s, e) => `${parseInt(s, 10)} сезон ${parseInt(e, 10)} серия`);

  const qLower = q.toLowerCase();

  // Season extraction: handles "3 сезон", "3-й сезон", "сезон 3", "season 3"
  let season = null;
  const sBefore = qLower.match(/(\d+)\s*(?:-?й\s*)?(?:сезон|season)/iu);
  if (sBefore) {
    season = parseInt(sBefore[1], 10);
  } else {
    const sAfter = qLower.match(/(?:сезон|season)\s*[:#-]?\s*(\d+)/iu);
    if (sAfter) season = parseInt(sAfter[1], 10);
  }

  // Episode extraction: handles "5 серия", "5-я серия", "серия 5", "5 эпизод", "эпизод 5"
  let episode = null;
  const eBefore = qLower.match(/(\d+)\s*(?:-?[яеи]\s*)?(?:сери[яиюе]|эпизод|episode|ep|eps)/iu);
  if (eBefore) {
    episode = parseInt(eBefore[1], 10);
  } else {
    const eAfter = qLower.match(/(?:сери[яиюе]|эпизод|episode|ep)\s*[:#-]?\s*(\d+)/iu);
    if (eAfter) episode = parseInt(eAfter[1], 10);
  }

  // Extract core show title
  let core = qLower
    // Remove season phrases
    .replace(/\d+\s*(?:-?й\s*)?(?:сезон|season)/giu, ' ')
    .replace(/(?:сезон|season)\s*[:#-]?\s*\d+/giu, ' ')
    .replace(/(?:сезон|season)/giu, ' ')
    // Remove episode phrases
    .replace(/\d+\s*(?:-?[яеи]\s*)?(?:сери[яиюе]|эпизод|episode|ep|eps)/giu, ' ')
    .replace(/(?:сери[яиюе]|эпизод|episode|ep)\s*[:#-]?\s*\d+/giu, ' ')
    .replace(/(?:сери[яиюе]|эпизод|episode|ep|eps)/giu, ' ')
    // Remove common search noise phrases
    .replace(/(?:все\s+серии(?:\s+подряд)?|смотреть\s+онлайн|в\s+хорошем\s+качестве|на\s+русском|дубляж|full\s*hd|1080p|720p|бесплатно)/giu, ' ')
    .replace(/[«»""'()\[\],.!?:;\/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const coreWords = core.split(/\s+/).filter((w) => w.length >= 2);

  return {
    season,
    episode,
    core,
    coreWords,
    original: String(rawQuery || '').trim()
  };
}

export function scoreVideoRelevance(itemTitle, rawQueryOrParsed, itemAuthor = '') {
  const t = (itemTitle || '').toLowerCase();
  const a = (itemAuthor || '').toLowerCase();
  if (!t) return 0;

  const parsed =
    typeof rawQueryOrParsed === 'object' && rawQueryOrParsed !== null && 'coreWords' in rawQueryOrParsed
      ? rawQueryOrParsed
      : parseSearchQuery(String(rawQueryOrParsed || ''));

  const { season, episode, core, coreWords, original } = parsed;
  const origLower = (original || '').toLowerCase().trim();
  if (!origLower) return 0;

  // CRITICAL: If query has core words (e.g. series or film title), at least ONE word
  // or root stem MUST match in the video title, or author MUST match.
  // Otherwise, it is an unrelated show and score MUST be 0!
  if (coreWords.length > 0) {
    let matchedCore = 0;
    for (const w of coreWords) {
      const stem = w.length >= 5 ? w.slice(0, -1) : w;
      if (t.includes(w) || t.includes(stem)) {
        matchedCore++;
      }
    }
    const authorMatches = coreWords.some((w) => a.includes(w));
    if (matchedCore === 0 && !authorMatches) {
      return 0; // Completely unrelated show/series!
    }
  }

  let score = 50;

  // Match core title phrase
  if (core && t.includes(core)) {
    score += 50;
  }

  // Exact original query match
  if (t.includes(origLower)) {
    score += 60;
  }

  // Season check
  if (season !== null) {
    const sRegex = new RegExp(
      `(?:${season}\\s*(?:-?й\\s*)?(?:сезон|season)|(?:сезон|season)\\s*[:#-]?\\s*${season}|\\bs0*${season}\\b)`,
      'iu'
    );
    if (sRegex.test(t)) {
      score += 60; // Exact matching season!
    } else {
      const otherS =
        t.match(/(\d+)\s*(?:-?й\s*)?(?:сезон|season)/iu) ||
        t.match(/(?:сезон|season)\s*[:#-]?\s*(\d+)/iu);
      if (otherS && parseInt(otherS[1], 10) !== season) {
        score -= 50; // Heavy penalty for wrong season
      }
    }
  }

  // Episode check
  if (episode !== null) {
    const eRegex = new RegExp(
      `(?:${episode}\\s*(?:-?[яеи]\\s*)?(?:сери|эпизод|ep)|(?:сери|эпизод|ep)\\s*[:#-]?\\s*${episode}|\\be0*${episode}\\b)`,
      'iu'
    );
    const isAllSeries = /(?:все\s+серии|весь\s+сезон)/iu.test(t);
    if (eRegex.test(t)) {
      score += 70; // Exact matching episode!
    } else if (isAllSeries) {
      score += 30; // Contains all series of the season
    } else {
      const otherE =
        t.match(/(\d+)\s*(?:-?[яеи]\s*)?(?:сери|эпизод)/iu) ||
        t.match(/(?:сери|эпизод)\s*[:#-]?\s*(\d+)/iu);
      if (otherE && parseInt(otherE[1], 10) !== episode) {
        score -= 40; // Penalty for wrong episode
      }
    }
  }

  // Penalty for trailers / teasers / reviews unless explicitly searched
  const isTrailer = /(?:трейлер|тизер|обзор|отрывок|реакция|фрагмент|trailer|teaser|review|клип)/iu.test(t);
  const wantsTrailer = /(?:трейлер|тизер|trailer|teaser)/iu.test(origLower);
  if (isTrailer && !wantsTrailer) {
    score -= 40;
  }

  return Math.max(0, score);
}

export function cleanSearchQuery(query = '') {
  let cleaned = query
    .replace(/\bs(\d{1,2})e(\d{1,2})\b/gi, (_, s, e) => `${parseInt(s, 10)} сезон ${parseInt(e, 10)} серия`)
    .replace(/(?:смотреть\s+онлайн|в\s+хорошем\s+качестве|full\s*hd|1080p|720p|бесплатно|на\s+русском|все\s+серии\s+подряд)/gi, ' ')
    .replace(/[«»""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export async function searchYouTube(query, limit = 16) {
  const q = String(query || '').trim();
  if (!q) return [];
  const parsed = parseSearchQuery(q);

  const trySearch = async (qText) => {
    const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(qText), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const list = [];
    for (const item of contents) {
      const vr = item.videoRenderer;
      if (vr && vr.videoId) {
        const title = decodeHtml(vr.title?.runs?.[0]?.text || vr.title?.simpleText || '');
        if (title) {
          const author = decodeHtml(vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || 'YouTube');
          const authorAvatar = vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
          const thumb = vr.thumbnail?.thumbnails?.pop()?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
          const dur = vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || '';
          const score = scoreVideoRelevance(title, parsed, author);

          if (score === 0 && parsed.coreWords.length > 0) continue;

          const videoObj = {
            id: vr.videoId,
            platform: 'youtube',
            platformLabel: 'YouTube',
            title,
            url: `https://www.youtube.com/watch?v=${vr.videoId}`,
            thumbnail: thumb,
            author,
            authorAvatar,
            duration: dur,
            _score: score
          };
          rememberSearchItem(videoObj);
          list.push(videoObj);
        }
      }
    }
    return list;
  };

  try {
    let list = await trySearch(query);
    const cleaned = cleanSearchQuery(query);
    if ((!list || list.length < 3) && cleaned && cleaned !== query) {
      const fallbackList = await trySearch(cleaned);
      if (fallbackList.length > 0) {
        const seen = new Set(list.map((x) => x.id));
        for (const item of fallbackList) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            list.push(item);
          }
        }
      }
    }
    list.sort((a, b) => (b._score || 0) - (a._score || 0));
    return list.slice(0, limit);
  } catch (err) {
    console.warn('[Search] YouTube error:', err.message);
    return [];
  }
}

export async function searchVK(query, limit = 18) {
  const q = String(query || '').trim();
  if (!q) return [];
  const parsed = parseSearchQuery(q);

  try {
    const res = await fetch('https://vk.com/al_video.php?act=search_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      body: 'al=1&q=' + encodeURIComponent(q),
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) return [];
    const buf = await res.arrayBuffer();
    const text = new TextDecoder('windows-1251').decode(buf);
    const json = JSON.parse(text);
    const rawList = json?.payload?.[1]?.[2]?.list || [];

    const list = [];
    for (const item of rawList) {
      const oid = item[0];
      const vid = item[1];
      const thumb = item[2] || '';
      const rawTitle = decodeHtml(item[3] || '');

      // In VK internal payload:
      // item[4] is a bitmask/flag integer (16384 = 0x4000), NOT duration!
      // item[5] is the human-readable formatted duration string (e.g. "2:01:16" or "14:20").
      // item[19] is the duration in seconds (e.g. 7276).
      let dur = '';
      if (typeof item[5] === 'string' && item[5].trim()) {
        dur = item[5].trim();
      } else if (typeof item[19] === 'number' && item[19] > 0) {
        dur = formatSeconds(item[19]);
      }

      // item[8] contains the author link/name, item[35] contains author avatar
      let author = 'VK Video';
      if (item[8]) {
        author = String(item[8]).replace(/<[^>]+>/g, '').trim() || 'VK Video';
      }
      const authorAvatar = item[35] || 'https://cdn-icons-png.flaticon.com/128/145/145813.png';

      const score = scoreVideoRelevance(rawTitle, parsed, author);
      if (score === 0 && parsed.coreWords.length > 0) continue;

      const videoUrl = `https://vk.com/video${oid}_${vid}`;
      const videoObj = {
        id: `vk_${oid}_${vid}`,
        platform: 'vk',
        platformLabel: 'VK Video',
        title: rawTitle || 'VK Video',
        url: videoUrl,
        thumbnail: thumb,
        author: author,
        authorAvatar: authorAvatar,
        duration: dur,
        _score: score
      };

      rememberSearchItem(videoObj);
      list.push(videoObj);
    }

    list.sort((a, b) => (b._score || 0) - (a._score || 0));
    return list.slice(0, limit);
  } catch (err) {
    console.warn('[Search] VK error:', err.message);
    return [];
  }
}

export async function searchRutube(query, limit = 18) {
  const q = String(query || '').trim();
  if (!q) return [];
  const parsed = parseSearchQuery(q);
  const qClean = cleanSearchQuery(query);
  const qLower = q.toLowerCase();

  // 1. Search priority channel catalog first
  const priorityMatches = [];
  const seenIds = new Set();

  for (const item of priorityCatalog) {
    const score = scoreVideoRelevance(item.title, parsed, item.author);

    // Only include if score > 0 (strictly matching show/title/author)
    if (score > 0) {
      const boostedScore = score + 50; // VIP Priority Channel bonus
      const videoObj = {
        ...item,
        _score: boostedScore
      };
      rememberSearchItem(videoObj);
      priorityMatches.push(videoObj);
      seenIds.add(item.id);
      if (item.url) seenIds.add(item.url);
    }
  }

  priorityMatches.sort((a, b) => b._score - a._score);

  // 2. Live Rutube API search to find global videos
  const tryLiveSearch = async (qText) => {
    const urls = [
      'https://rutube.ru/api/search/video/?query=' + encodeURIComponent(qText) + '&format=json',
      'https://rutube.ru/api/search/video/?query=' + encodeURIComponent(qText)
    ];

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://rutube.ru/',
      'Origin': 'https://rutube.ru'
    };

    for (const u of urls) {
      try {
        const res = await fetch(u, {
          headers: browserHeaders,
          signal: AbortSignal.timeout(7000)
        });
        if (!res.ok) continue;
        const data = await res.json();
        const list = [];
        for (const item of data.results || []) {
          const title = decodeHtml(item.title || '');
          if (title && item.video_url) {
            let dur = '';
            if (item.duration) {
              dur = formatSeconds(item.duration);
            }
            const itemId = item.id || item.video_url;
            const authorName = decodeHtml(item.author?.name || 'Rutube');
            let itemScore = scoreVideoRelevance(title, parsed, authorName);

            // If score is 0 and query specifies a show, reject unrelated videos
            if (itemScore === 0 && parsed.coreWords.length > 0) continue;

            if (authorName.includes('Смотри кино') || authorName.includes('Фильмач')) {
              itemScore += 50;
            }

            const videoObj = {
              id: itemId,
              platform: 'rutube',
              platformLabel: 'Rutube',
              title,
              url: item.video_url,
              thumbnail: item.thumbnail_url || (item.picture_thumbnail ? item.picture_thumbnail.replace('{width}x{height}', '640x360') : ''),
              author: authorName,
              authorAvatar: item.author?.avatar_url || '',
              duration: dur,
              _score: itemScore
            };
            rememberSearchItem(videoObj);
            list.push(videoObj);
          }
        }
        if (list.length > 0) return list;
      } catch (e) {
        // continue
      }
    }
    return [];
  };

  let liveList = [];
  try {
    liveList = await tryLiveSearch(query);

    // If few results and query has season/episode, also query smart variations
    if (liveList.length < 5 && (parsed.season !== null || parsed.episode !== null)) {
      const variations = [];
      if (parsed.core && parsed.season !== null) {
        variations.push(`${parsed.core} ${parsed.season} сезон`);
      }
      if (parsed.core && parsed.core !== query.toLowerCase()) {
        variations.push(parsed.core);
      }
      for (const v of variations) {
        const vList = await tryLiveSearch(v);
        if (vList.length > 0) {
          const seenLive = new Set(liveList.map((x) => x.id));
          for (const item of vList) {
            if (!seenLive.has(item.id)) {
              seenLive.add(item.id);
              liveList.push(item);
            }
          }
        }
      }
    } else if (liveList.length < 3 && qClean && qClean !== query) {
      const fallbackList = await tryLiveSearch(qClean);
      if (fallbackList.length > 0) {
        const seenLive = new Set(liveList.map((x) => x.id));
        for (const item of fallbackList) {
          if (!seenLive.has(item.id)) {
            seenLive.add(item.id);
            liveList.push(item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Search] Rutube live search error:', err.message);
  }

  // 3. Merge priority channel matches with live search results
  const merged = [...priorityMatches];
  for (const item of liveList) {
    if (!seenIds.has(item.id) && !seenIds.has(item.url)) {
      seenIds.add(item.id);
      if (item.url) seenIds.add(item.url);
      merged.push(item);
    }
  }

  merged.sort((a, b) => (b._score || 0) - (a._score || 0));

  // Fallback if 0 results and user specifically queried channel name
  if (merged.length === 0 && (qLower.includes('смотри кино') || qLower.includes('фильмач'))) {
    return priorityCatalog.slice(0, limit);
  }

  return merged.slice(0, limit);
}

export async function searchVideos(query, platform = 'all') {
  const q = String(query || '').trim();
  if (!q) return { success: true, results: [] };
  const normPlat = String(platform || 'all').toLowerCase();

  if (normPlat === 'youtube') {
    const yt = await searchYouTube(q, 18);
    return { success: true, results: yt };
  }

  if (normPlat === 'vk') {
    const vk = await searchVK(q, 20);
    return { success: true, results: vk };
  }

  if (normPlat === 'rutube') {
    const rt = await searchRutube(q, 18);
    return { success: true, results: rt };
  }

  // 'all': Search VK Video, YouTube, and Rutube simultaneously
  const [vk, yt, rt] = await Promise.all([
    searchVK(q, 20).catch(() => []),
    searchYouTube(q, 16).catch(() => []),
    searchRutube(q, 10).catch(() => [])
  ]);

  const all = [...vk, ...yt, ...rt];
  const seen = new Set();
  const unique = [];

  for (const item of all) {
    const key = item.url || item.id;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => (b._score || 0) - (a._score || 0));
  return { success: true, results: unique.slice(0, 24) };
}
