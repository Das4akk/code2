const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]'
]);

function isPrivateIpv4(host) {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
}

function isPrivateIpv6(host) {
    const h = host.toLowerCase();
    if (h === '::1') return true;
    if (h.startsWith('fc') || h.startsWith('fd')) return true;
    if (h.startsWith('fe80')) return true;
    return false;
}

export function validateMediaUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
        throw Object.assign(new Error('URL must be a string'), { code: 'INVALID_URL' });
    }

    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.length > 2048) {
        throw Object.assign(new Error('URL is empty or too long'), { code: 'INVALID_URL' });
    }

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw Object.assign(new Error('Malformed URL'), { code: 'INVALID_URL' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw Object.assign(new Error('Only http/https URLs are allowed'), { code: 'INVALID_URL' });
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname) {
        throw Object.assign(new Error('Missing hostname'), { code: 'INVALID_URL' });
    }

    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
        throw Object.assign(new Error('Internal or local URLs are not allowed'), { code: 'INVALID_URL' });
    }

    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
        throw Object.assign(new Error('Private network URLs are not allowed'), { code: 'INVALID_URL' });
    }

    return parsed.href;
}

export function detectPlatform(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('rutube.ru')) return 'rutube';
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
    if (host.includes('vk.com') || host.includes('vkvideo.ru')) return 'vk';
    if (host.includes('vimeo.com')) return 'vimeo';
    if (host.includes('twitch.tv')) return 'twitch';
    if (/\.(mp4|webm|m4v|mov|mkv)(\?|#|$)/i.test(url)) return 'direct';
    return 'unknown';
}
