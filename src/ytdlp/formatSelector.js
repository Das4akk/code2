function hasUrl(format) {
    return Boolean(format?.url || format?.manifest_url);
}

function formatUrl(format) {
    return format.url || format.manifest_url || '';
}

function isHlsFormat(format) {
    const url = formatUrl(format);
    const protocol = String(format.protocol || '').toLowerCase();
    const ext = String(format.ext || '').toLowerCase();
    return protocol.includes('m3u8') || ext === 'm3u8' || /\.m3u8(\?|$)/i.test(url);
}

function isMp4Format(format) {
    const ext = String(format.ext || '').toLowerCase();
    const url = formatUrl(format);
    return ext === 'mp4' || /\.mp4(\?|$)/i.test(url);
}

function scoreFormat(format) {
    const height = Number(format.height) || 0;
    const tbr = Number(format.tbr) || 0;
    const hasVideo = format.vcodec && format.vcodec !== 'none';
    const hasAudio = format.acodec && format.acodec !== 'none';
    let score = height * 10 + tbr;
    if (hasVideo && hasAudio) score += 5000;
    if (isMp4Format(format)) score += 2500;
    if (isHlsFormat(format)) score += 800;
    return score;
}

export function pickStreamFromYtDlpInfo(info) {
    const root = info?._type === 'playlist' && Array.isArray(info.entries) && info.entries.length
        ? info.entries[0]
        : info;

    if (!root) {
        throw Object.assign(new Error('Empty yt-dlp response'), { code: 'EXTRACTION_FAILED' });
    }

    const isYouTube = String(root.extractor_key || '').toLowerCase() === 'youtube';
    const formats = Array.isArray(root.formats) ? root.formats.filter(hasUrl) : [];

    // Progressive mp4 with both video and audio
    const progressiveMp4 = formats
        .filter(f => isMp4Format(f) && f.vcodec !== 'none' && f.acodec !== 'none')
        .sort((a, b) => scoreFormat(b) - scoreFormat(a));

    if (progressiveMp4.length) {
        const best = progressiveMp4[0];
        return {
            source: formatUrl(best),
            isHls: false,
            ext: 'mp4',
            formatNote: best.format_note || 'mp4'
        };
    }

    const hlsFormats = formats
        .filter(f => isHlsFormat(f) && !isYouTube)
        .sort((a, b) => scoreFormat(b) - scoreFormat(a));

    if (hlsFormats.length) {
        const best = hlsFormats[0];
        return {
            source: formatUrl(best),
            isHls: true,
            ext: 'm3u8',
            formatNote: best.format_note || 'hls'
        };
    }

    const fallback = formats.sort((a, b) => scoreFormat(b) - scoreFormat(a))[0];
    if (fallback) {
        return {
            source: formatUrl(fallback),
            isHls: isYouTube ? false : isHlsFormat(fallback),
            ext: fallback.ext || 'unknown',
            formatNote: fallback.format_note || 'fallback'
        };
    }

    if (root.url) {
        return {
            source: root.url,
            isHls: isYouTube ? false : /\.m3u8(\?|$)/i.test(root.url),
            ext: root.ext || 'unknown',
            formatNote: 'root'
        };
    }

    throw Object.assign(new Error('No playable stream URL in yt-dlp output'), { code: 'EXTRACTION_FAILED' });
}

export function normalizeYtDlpMetadata(info) {
    const root = info?._type === 'playlist' && Array.isArray(info.entries) && info.entries.length
        ? info.entries[0]
        : info;

    return {
        title: root.title || root.fulltitle || 'Untitled',
        duration: Number(root.duration) || 0,
        thumbnail: root.thumbnail || (Array.isArray(root.thumbnails) ? root.thumbnails[root.thumbnails.length - 1]?.url : '') || '',
        id: root.id || '',
        webpage_url: root.webpage_url || root.original_url || ''
    };
}
