import { YtDlpExtractor } from './baseExtractor.js';

export class YoutubeExtractor extends YtDlpExtractor {
    constructor() {
        super('youtube');
    }

    matches(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host.includes('youtube.com') || host === 'youtu.be' || host.endsWith('.youtube.com');
        } catch {
            return false;
        }
    }
}
