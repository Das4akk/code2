import { validateMediaUrl, detectPlatform } from './validation/urlValidator.js';
import { resolveCache } from './cache/memoryCache.js';
import { getExtractorForUrl } from './extractors/index.js';

export async function resolveMedia(rawUrl) {
    const url = validateMediaUrl(rawUrl);
    const cached = resolveCache.get(url);
    if (cached) {
        return { ...cached, cached: true };
    }

    const platform = detectPlatform(url);
    const extractor = getExtractorForUrl(url, platform === 'unknown' ? '' : platform);

    if (!extractor) {
        throw Object.assign(new Error('Unsupported URL or platform'), { code: 'UNSUPPORTED_URL' });
    }

    const result = await extractor.extract(url);
    const payload = {
        success: true,
        source: result.source,
        title: result.title,
        duration: result.duration,
        thumbnail: result.thumbnail,
        platform: result.platform,
        isHls: Boolean(result.isHls),
        ext: result.ext || '',
        formatNote: result.formatNote || '',
        webpageUrl: result.webpageUrl || url,
        resolvedAt: Date.now()
    };

    resolveCache.set(url, payload);
    return payload;
}
