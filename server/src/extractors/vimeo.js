import { YtDlpExtractor } from './baseExtractor.js';

export class VimeoExtractor extends YtDlpExtractor {
    constructor() {
        super('vimeo');
    }

    matches(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host.includes('vimeo.com');
        } catch {
            return false;
        }
    }
}
