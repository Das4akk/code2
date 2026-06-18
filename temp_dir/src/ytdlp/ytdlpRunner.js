import youtubeDl from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';

const cookiesPath = path.resolve('cookies.txt');

export function runYtDlpJson(url) {
    const opts = {
        dumpJson: true,
        noWarnings: true,
        noPlaylist: true
    };
    
    if (fs.existsSync(cookiesPath)) {
        opts.cookies = cookiesPath;
    }

    return youtubeDl(url, opts).catch(err => {
        const message = err.message || 'yt-dlp failed';
        if (/Sign in to confirm you’re not a bot/i.test(message) || /bot behavior/i.test(message)) {
            throw Object.assign(new Error('YouTube restricts this video. Wait for plugin update or use cookies.'), { code: 'BOT_PROTECTION' });
        }
        if (/unsupported url|no suitable extractor/i.test(message)) {
            throw Object.assign(new Error(message), { code: 'UNSUPPORTED_URL' });
        }
        throw Object.assign(new Error(message), { code: 'EXTRACTION_FAILED' });
    });
}
