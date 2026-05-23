import { YtDlpExtractor } from './baseExtractor.js';

export class VkExtractor extends YtDlpExtractor {
    constructor() {
        super('vk');
    }

    matches(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host.includes('vk.com') || host.includes('vkvideo.ru');
        } catch {
            return false;
        }
    }
}
