import { YtDlpExtractor } from './baseExtractor.js';

export class TwitchExtractor extends YtDlpExtractor {
    constructor() {
        super('twitch');
    }

    matches(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host.includes('twitch.tv');
        } catch {
            return false;
        }
    }
}
