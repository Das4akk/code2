import { spawn } from 'child_process';
import { YTDLP_PATH, YTDLP_TIMEOUT_MS, MAX_JSON_BYTES } from '../config.js';

export function runYtDlpJson(url) {
    return new Promise((resolve, reject) => {
        const args = ['-J', '--no-playlist', '--no-warnings', url];
        const child = spawn(YTDLP_PATH, args, {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGKILL');
            reject(Object.assign(new Error('yt-dlp execution timed out'), { code: 'TIMEOUT' }));
        }, YTDLP_TIMEOUT_MS);

        const cleanup = () => {
            clearTimeout(timer);
            child.removeAllListeners();
            if (!child.killed) {
                try { child.kill('SIGKILL'); } catch { /* ignore */ }
            }
        };

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString('utf8');
            if (Buffer.byteLength(stdout, 'utf8') > MAX_JSON_BYTES) {
                killed = true;
                child.kill('SIGKILL');
                cleanup();
                reject(Object.assign(new Error('yt-dlp output exceeds size limit'), { code: 'EXTRACTION_FAILED' }));
            }
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
            if (stderr.length > 64_000) stderr = stderr.slice(-64_000);
        });

        child.on('error', (err) => {
            if (killed) return;
            cleanup();
            if (err.code === 'ENOENT') {
                reject(Object.assign(new Error('yt-dlp binary not found. Install yt-dlp and set YTDLP_PATH.'), { code: 'EXTRACTION_FAILED' }));
                return;
            }
            reject(Object.assign(err, { code: 'EXTRACTION_FAILED' }));
        });

        child.on('close', (code) => {
            if (killed) return;
            cleanup();

            if (code !== 0) {
                const message = (stderr || stdout || `yt-dlp exited with code ${code}`).trim();
                if (/unsupported url|no suitable extractor/i.test(message)) {
                    reject(Object.assign(new Error(message), { code: 'UNSUPPORTED_URL' }));
                    return;
                }
                reject(Object.assign(new Error(message || 'yt-dlp failed'), { code: 'EXTRACTION_FAILED' }));
                return;
            }

            try {
                const parsed = JSON.parse(stdout);
                resolve(parsed);
            } catch {
                reject(Object.assign(new Error('Failed to parse yt-dlp JSON output'), { code: 'EXTRACTION_FAILED' }));
            }
        });
    });
}
