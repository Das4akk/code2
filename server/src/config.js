import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundledYtDlpWin = path.join(__dirname, '..', 'bin', 'yt-dlp.exe');

function resolveDefaultYtDlpPath() {
    if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
    if (process.platform === 'win32' && fs.existsSync(bundledYtDlpWin)) return bundledYtDlpWin;
    return 'yt-dlp';
}

export const PORT = Number(process.env.PORT || 3847);
export const YTDLP_PATH = resolveDefaultYtDlpPath();
export const YTDLP_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 90_000);
export const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000);
export const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 8 * 1024 * 1024);
export const MAX_BODY_BYTES = 16 * 1024;
export const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
