import { RutubeExtractor } from './rutube.js';
import { YoutubeExtractor } from './youtube.js';
import { VkExtractor } from './vk.js';
import { VimeoExtractor } from './vimeo.js';
import { TwitchExtractor } from './twitch.js';
import { DirectExtractor } from './direct.js';

const EXTRACTORS = [
    new DirectExtractor(),
    new RutubeExtractor(),
    new YoutubeExtractor(),
    new VkExtractor(),
    new VimeoExtractor(),
    new TwitchExtractor()
];

export function getExtractorForUrl(url, platformHint = '') {
    if (platformHint) {
        const byPlatform = EXTRACTORS.find(e => e.platform === platformHint && e.matches(url));
        if (byPlatform) return byPlatform;
    }
    return EXTRACTORS.find(e => e.matches(url)) || null;
}

export function listSupportedPlatforms() {
    return EXTRACTORS.map(e => e.platform);
}
