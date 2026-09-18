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

export async function getVideoInfo(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Empty URL' };
  }
  const trimmed = url.trim();

  // 1. YouTube
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    try {
      let watchUrl = trimmed;
      // Convert shorts or embed to watch?v=
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
    try {
      const oembedRes = await fetch(`https://rutube.ru/api/oembed/?url=${encodeURIComponent(trimmed)}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
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

      // Try video ID API
      const idMatch = trimmed.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/i);
      if (idMatch && idMatch[1]) {
        const apiRes = await fetch(`https://rutube.ru/api/video/${idMatch[1]}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
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
        signal: AbortSignal.timeout(4000)
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
  if (/vk\.com|vkvideo\.ru/i.test(trimmed)) {
    try {
      let embedUrl = trimmed;
      const vkMatch = trimmed.match(/(?:video|video_ext\.php\?).*(?:oid=|video-?)(-?\d+)[_]([A-Za-z0-9]+)/i) ||
                      trimmed.match(/video-?(\d+)_([A-Za-z0-9]+)/i);
      if (vkMatch) {
        const oid = vkMatch[1];
        const vid = vkMatch[2];
        embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2&js_api=1`;
      }

      // Try open page
      const pageRes = await fetch(trimmed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                           html.match(/<title>([^<]*)<\/title>/i);
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        let title = titleMatch ? decodeHtml(titleMatch[1].replace(/ - ВКонтакте$/i, '')) : '';
        if (title) {
          return {
            success: true,
            title,
            author: 'VK',
            thumbnail: imgMatch ? imgMatch[1] : '',
            platform: 'vk',
            platformLabel: 'VK Video',
            url: embedUrl
          };
        }
      }
      return {
        success: true,
        title: 'VK Video',
        author: 'VK',
        thumbnail: '',
        platform: 'vk',
        platformLabel: 'VK Video',
        url: embedUrl
      };
    } catch (err) {
      console.warn('[VideoInfo] VK error:', err.message);
    }
  }

  // 5. Twitch
  if (/twitch\.tv/i.test(trimmed)) {
    const channelMatch = trimmed.match(/twitch\.tv\/([^/?]+)/i);
    const channel = channelMatch ? channelMatch[1] : 'streamer';
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

  // 6. Generic web page / Direct stream
  try {
    const pageRes = await fetch(trimmed, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4500)
    });
    if (pageRes.ok) {
      const contentType = pageRes.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                           html.match(/<title>([^<]*)<\/title>/i);
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        const authorMatch = html.match(/<meta\s+name="author"\s+content="([^"]*)"/i);

        let title = titleMatch ? decodeHtml(titleMatch[1]) : '';
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(authorMatch ? authorMatch[1] : ''),
            thumbnail: imgMatch ? imgMatch[1] : '',
            platform: 'web',
            platformLabel: 'Веб',
            url: trimmed
          };
        }
      }
    }
  } catch (err) {}

  // 7. Fallback direct media file
  const filename = trimmed.split('/').pop().split('?')[0] || '';
  const cleanName = decodeURIComponent(filename)
    .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return {
    success: true,
    title: cleanName || 'Медиа комната',
    author: '',
    thumbnail: '',
    platform: /\.(mp4|webm|m4v|mov|mkv|m3u8)(\?|#|$)/i.test(trimmed) ? 'direct' : 'custom',
    platformLabel: 'Прямой поток',
    url: trimmed
  };
}

function scoreVideoRelevance(itemTitle, originalQuery) {
  const t = (itemTitle || '').toLowerCase();
  const q = (originalQuery || '').toLowerCase().trim();
  if (!t || !q) return 0;

  let score = 0;

  // Exact full query match
  if (t.includes(q)) score += 60;

  // Word token matches
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  let matchedCount = 0;
  for (const w of words) {
    if (t.includes(w)) {
      matchedCount++;
      score += 8;
    }
  }
  if (words.length > 0 && matchedCount === words.length) {
    score += 30; // All search words present in title
  }

  // Season match
  const sMatch =
    q.match(/(\d+)\s*(?:сезон|season)/i) ||
    q.match(/(?:сезон|season)\s*(\d+)/i) ||
    q.match(/\bs(\d{1,2})\b/i);
  if (sMatch) {
    const sNum = parseInt(sMatch[1], 10);
    const sRegex = new RegExp(
      `(?:${sNum}\\s*(?:сезон|season|s)|(?:сезон|season)\\s*${sNum})`,
      'i'
    );
    if (sRegex.test(t)) {
      score += 45; // Exact matching season!
    } else if (/(?:сезон|season)/i.test(t)) {
      score -= 25; // Wrong season penalty
    }
  }

  // Episode match
  const eMatch =
    q.match(/(\d+)\s*(?:сери[яию]|серия|эпизод|серии|ep|eps)/i) ||
    q.match(/(?:сери[яию]|эпизод|ep)\s*(\d+)/i) ||
    q.match(/\be(\d{1,2})\b/i);
  if (eMatch) {
    const eNum = parseInt(eMatch[1], 10);
    const eRegex = new RegExp(
      `(?:${eNum}\\s*(?:сери|эпизод|ep)|(?:сери|эпизод|ep)\\s*${eNum})`,
      'i'
    );
    if (eRegex.test(t)) {
      score += 45; // Exact matching episode!
    } else if (/(?:сери[яию]|эпизод)/i.test(t)) {
      score -= 20; // Wrong episode penalty
    }
  }

  // Demote recaps/trailers/teasers/reactions unless user specifically searched for them
  if (
    !/(?:трейлер|тизер|teaser|trailer)/i.test(q) &&
    /(?:трейлер|тизер|teaser|trailer|анонс)/i.test(t)
  ) {
    score -= 40;
  }
  if (
    !/(?:обзор|разбор|recap|reaction|реакци)/i.test(q) &&
    /(?:обзор|разбор|recap|реакция|reaction)/i.test(t)
  ) {
    score -= 30;
  }
  if (
    !/(?:клип|музыка|music|clip)/i.test(q) &&
    /(?:клип|музыка|ost|soundtrack)/i.test(t)
  ) {
    score -= 15;
  }

  return score;
}

function cleanSearchQuery(query = '') {
  let cleaned = query
    // Normalize S01E01 -> 1 сезон 1 серия
    .replace(/\bs(\d{1,2})e(\d{1,2})\b/gi, (_, s, e) => `${parseInt(s, 10)} сезон ${parseInt(e, 10)} серия`)
    // Remove common search noise phrases that cause 0 results
    .replace(/(?:смотреть\s+онлайн|в\s+хорошем\s+качестве|full\s*hd|1080p|720p|бесплатно|на\s+русском|все\s+серии\s+подряд)/gi, ' ')
    .replace(/[«»""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export async function searchYouTube(query, limit = 16) {
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
        const title = decodeHtml(vr.title?.runs?.[0]?.text || '');
        if (title) {
          const authorAvatar = vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
          list.push({
            id: vr.videoId,
            platform: 'youtube',
            platformLabel: 'YouTube',
            title,
            url: `https://www.youtube.com/watch?v=${vr.videoId}`,
            thumbnail: vr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
            author: decodeHtml(vr.ownerText?.runs?.[0]?.text || 'YouTube'),
            authorAvatar: authorAvatar,
            duration: vr.lengthText?.simpleText || '',
            _score: scoreVideoRelevance(title, query)
          });
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
        // Merge without duplicates
        const seen = new Set(list.map((x) => x.id));
        for (const item of fallbackList) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            list.push(item);
          }
        }
      }
    }

    list.sort((a, b) => b._score - a._score);
    return list.slice(0, limit);
  } catch (err) {
    console.warn('[Search] YouTube error:', err.message);
    return [];
  }
}

export async function searchRutube(query, limit = 16) {
  const trySearch = async (qText) => {
    const urls = [
      'https://rutube.ru/api/search/video/?query=' + encodeURIComponent(qText) + '&format=json',
      'https://rutube.ru/api/search/video/?query=' + encodeURIComponent(qText)
    ];

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://rutube.ru/',
      'Origin': 'https://rutube.ru',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site'
    };

    for (const u of urls) {
      try {
        const res = await fetch(u, {
          headers: browserHeaders,
          signal: AbortSignal.timeout(9000)
        });
        if (!res.ok) continue;
        const data = await res.json();
        const list = [];
        for (const item of data.results || []) {
          const title = decodeHtml(item.title || '');
          if (title && item.video_url) {
            let dur = '';
            if (item.duration) {
              const m = Math.floor(item.duration / 60);
              const s = String(item.duration % 60).padStart(2, '0');
              dur = `${m}:${s}`;
            }
            list.push({
              id: item.id || item.video_url,
              platform: 'rutube',
              platformLabel: 'Rutube',
              title,
              url: item.video_url,
              thumbnail: item.thumbnail_url || (item.picture_thumbnail ? item.picture_thumbnail.replace('{width}x{height}', '640x360') : ''),
              author: decodeHtml(item.author?.name || 'Rutube'),
              authorAvatar: item.author?.avatar_url || '',
              duration: dur,
              _score: scoreVideoRelevance(title, query)
            });
          }
        }
        if (list.length > 0) return list;
      } catch (e) {
        // continue to next url or retry
      }
    }
    return [];
  };

  try {
    let list = await trySearch(query);
    const cleaned = cleanSearchQuery(query);

    // If initial query returned 0 or very few results, fallback to cleaned query
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

    // If still 0 results and query mentions a season/episode, try series title + season
    if ((!list || list.length === 0)) {
      const sMatch = query.match(/(\d+)\s*(?:сезон|season)/i) || query.match(/(?:сезон|season)\s*(\d+)/i);
      const titleMatch = query.replace(/(?:сезон|season|серия|эпизод|\d+)/gi, '').trim();
      if (titleMatch.length > 2 && sMatch) {
        const broadQuery = `${titleMatch} ${sMatch[1]} сезон`;
        const broadList = await trySearch(broadQuery);
        if (broadList.length > 0) {
          list = broadList;
        }
      }
    }

    list.sort((a, b) => b._score - a._score);
    return list.slice(0, limit);
  } catch (err) {
    console.warn('[Search] Rutube error:', err.message);
    return [];
  }
}

export async function searchVideos(query, platform = 'all') {
  const q = String(query || '').trim();
  if (!q) return { success: true, results: [] };

  const normPlat = String(platform || 'all').toLowerCase();

  if (normPlat === 'youtube') {
    const yt = await searchYouTube(q, 18);
    return { success: true, results: yt };
  }

  if (normPlat === 'rutube') {
    const rt = await searchRutube(q, 18);
    return { success: true, results: rt };
  }

  // Interleave 'all' (YouTube + Rutube)
  const [yt, rt] = await Promise.all([
    searchYouTube(q, 10),
    searchRutube(q, 10)
  ]);

  const combined = [];
  const maxLen = Math.max(yt.length, rt.length);
  for (let i = 0; i < maxLen; i++) {
    if (yt[i]) combined.push(yt[i]);
    if (rt[i]) combined.push(rt[i]);
  }

  return { success: true, results: combined };
}
