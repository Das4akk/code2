const DIRECT_MEDIA_RE = /\.(mp4|webm|m4v|mov|mkv|m3u8)(\?|#|$)/i;

export class DirectExtractor {
    constructor() {
        this.platform = 'direct';
    }

    matches(url) {
        return DIRECT_MEDIA_RE.test(url);
    }

    async extract(url) {
        const isHls = /\.m3u8(\?|#|$)/i.test(url);
        const extMatch = url.match(/\.(\w+)(\?|#|$)/i);
        return {
            success: true,
            source: url,
            title: 'Direct media',
            duration: 0,
            thumbnail: '',
            platform: 'direct',
            isHls,
            ext: extMatch ? extMatch[1].toLowerCase() : (isHls ? 'm3u8' : 'mp4'),
            formatNote: 'direct',
            webpageUrl: url
        };
    }
}
