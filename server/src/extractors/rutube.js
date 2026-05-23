import { YtDlpExtractor } from './baseExtractor.js';

export class RutubeExtractor extends YtDlpExtractor {
    constructor() {
        super('rutube');
    }

    matches(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host.includes('rutube.ru');
        } catch {
            return false;
        }
    }
}
