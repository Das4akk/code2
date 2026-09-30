import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveHtmlIncludes(content: string, baseDir: string = '.'): string {
  const includeRegex = /<!--\s*@include\s+["']?([^"'\s>]+)["']?\s*-->/g;
  return content.replace(includeRegex, (match, includePath) => {
    const fullPath = path.resolve(baseDir, includePath);
    if (fs.existsSync(fullPath)) {
      const includedContent = fs.readFileSync(fullPath, 'utf8');
      return resolveHtmlIncludes(includedContent, path.dirname(fullPath));
    } else {
      console.warn('Include file not found:', fullPath);
      return match;
    }
  });
}

function htmlPartialsPlugin(): Plugin {
  return {
    name: 'html-partials-plugin',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return resolveHtmlIncludes(html, process.cwd());
      }
    }
  };
}

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost:3000');
        const pathname = url.pathname;

        if (pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), app: 'COWIO', mode: 'dev' }));
          return;
        }

        if (pathname === '/api/auth/check-role') {
          try {
            if (typeof (res as any).status !== 'function') {
              (res as any).status = function (code: number) {
                this.statusCode = code;
                return this;
              };
            }
            if (typeof (res as any).json !== 'function') {
              (res as any).json = function (data: any) {
                this.setHeader('Content-Type', 'application/json; charset=utf-8');
                this.end(JSON.stringify(data));
                return this;
              };
            }
            // @ts-ignore
            const checkRoleModule = await import('./api/auth/check-role.js');
            const handler = checkRoleModule.default || checkRoleModule;
            return await handler(req, res);
          } catch (e: any) {
            console.error('[vite check-role middleware error]:', e);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, role: 'user', isCreator: false, isAdmin: false }));
            return;
          }
        }

        if (pathname === '/api/video/search') {
          try {
            // @ts-ignore
            const { searchVideos } = await import('./api/video-service.js');
            const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
            const platform = url.searchParams.get('platform') || 'all';
            const data = await searchVideos(q, platform);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(data));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: err.message, results: [] }));
            return;
          }
        }

        if (pathname === '/api/video/info') {
          try {
            // @ts-ignore
            const { getVideoInfo } = await import('./api/video-service.js');
            const videoUrl = url.searchParams.get('url') || '';
            const data = await getVideoInfo(videoUrl);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(data));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }

        if (pathname === '/api/emoji-proxy') {
          try {
            const EMOJI_ALIASES: Record<string, string> = {
              'objects/pen.webp': 'Objects/Pencil.webp',
              'symbols/back arrow.webp': 'Symbols/Top Arrow.webp',
              'symbols/back%20arrow.webp': 'Symbols/Top Arrow.webp',
              'symbols/counterclockwise arrows button.webp': 'Symbols/Currency Exchange.webp',
              'symbols/counterclockwise%20arrows%20button.webp': 'Symbols/Currency Exchange.webp',
              'objects/wastebasket.webp': 'Symbols/Cross Mark.webp',
              'objects/paperclip.webp': 'Objects/Memo.webp',
              'objects/envelope.webp': 'Objects/Incoming Envelope.webp',
              'objects/package.webp': 'Objects/Toolbox.webp'
            };
            let rawPath = (url.searchParams.get('path') || url.searchParams.get('url') || '').trim();
            if (!rawPath) {
              res.setHeader('Content-Type', 'image/webp');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64'));
              return;
            }
            let emojiPath = rawPath
              .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
              .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
              .replace(/^\/+/, '');
            try { emojiPath = decodeURIComponent(emojiPath); } catch (e) {}

            const lowerKey = emojiPath.toLowerCase();
            if (EMOJI_ALIASES[lowerKey]) {
              emojiPath = EMOJI_ALIASES[lowerKey];
            }

            const encodedPath = encodeURI(emojiPath);
            const mirrors = [
              `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
              `https://testingcf.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
              `https://fastly.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`,
              `https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`,
              `https://cdn.statically.io/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/${encodedPath}`
            ];
            try {
              const fetchWinner = await Promise.any(
                mirrors.map(async (mirror) => {
                  const fetchRes = await fetch(mirror, {
                    signal: AbortSignal.timeout(5000),
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                  });
                  if (!fetchRes.ok) throw new Error('Not ok: ' + fetchRes.status);
                  const arrayBuffer = await fetchRes.arrayBuffer();
                  const contentType = fetchRes.headers.get('content-type') || 'image/webp';
                  return { buffer: Buffer.from(arrayBuffer), contentType };
                })
              );
              res.setHeader('Content-Type', fetchWinner.contentType);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(fetchWinner.buffer);
              return;
            } catch (err) {
              res.setHeader('Content-Type', 'image/webp');
              res.end(Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64'));
              return;
            }
          } catch (e: any) {
            res.setHeader('Content-Type', 'image/webp');
            res.end(Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64'));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [htmlPartialsPlugin(), react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  };
});
