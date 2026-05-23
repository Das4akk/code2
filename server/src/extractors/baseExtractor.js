import { runYtDlpJson } from '../ytdlp/ytdlpRunner.js';
import { normalizeYtDlpMetadata, pickStreamFromYtDlpInfo } from '../ytdlp/formatSelector.js';

export class YtDlpExtractor {
    constructor(platform) {
        this.platform = platform;
    }

    matches(url) {
        return false;
    }

    async extract(url) {
        const info = await runYtDlpJson(url);
        const meta = normalizeYtDlpMetadata(info);
        const stream = pickStreamFromYtDlpInfo(info);

        return {
            success: true,
            source: stream.source,
            title: meta.title,
            duration: meta.duration,
            thumbnail: meta.thumbnail,
            platform: this.platform,
            isHls: stream.isHls,
            ext: stream.ext,
            formatNote: stream.formatNote,
            webpageUrl: meta.webpage_url || url
        };
    }
}
