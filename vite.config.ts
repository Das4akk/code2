import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost:3000');
        const pathname = url.pathname;

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
            let rawPath = (url.searchParams.get('path') || url.searchParams.get('url') || '').trim();
            if (!rawPath) {
              res.setHeader('Content-Type', 'image/webp');
              res.end(Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64'));
              return;
            }
            let emojiPath = rawPath
              .replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, '')
              .replace(/^Telegram-Animated-Emojis\/(main\/)?/, '')
              .replace(/^\/+/, '');
            try { emojiPath = decodeURIComponent(emojiPath); } catch (e) {}
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
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
