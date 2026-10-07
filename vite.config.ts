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

        // Polyfill status and json methods on res for serverless handler compatibility
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

        // Parse request body for POST/PUT/PATCH if needed
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
          if (!(req as any).body) {
            try {
              const buffers: Buffer[] = [];
              for await (const chunk of req) {
                buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              const rawBody = Buffer.concat(buffers).toString('utf8');
              if (rawBody) {
                try {
                  (req as any).body = JSON.parse(rawBody);
                } catch {
                  (req as any).body = rawBody;
                }
              } else {
                (req as any).body = {};
              }
            } catch (bodyErr) {
              (req as any).body = {};
            }
          }
        }

        // Attach query params to req.query
        (req as any).query = Object.fromEntries(url.searchParams.entries());

        try {
          if (pathname.startsWith('/api/auth')) {
            // @ts-ignore
            const mod = await import('./api/auth.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/custom-auth')) {
            // @ts-ignore
            const mod = await import('./api/custom-auth.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/admin')) {
            // @ts-ignore
            const mod = await import('./api/admin.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/users')) {
            // @ts-ignore
            const mod = await import('./api/users.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/chat')) {
            // @ts-ignore
            const mod = await import('./api/chat.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname === '/api/resolve-media') {
            // @ts-ignore
            const mod = await import('./api/resolve-media.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/video') || pathname.startsWith('/api/library')) {
            // @ts-ignore
            const mod = await import('./api/video.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname.startsWith('/api/premium')) {
            // @ts-ignore
            const mod = await import('./api/premium.js');
            return await (mod.default || mod)(req, res);
          }

          if (pathname === '/api/emoji-proxy') {
            // @ts-ignore
            const mod = await import('./api/emoji-proxy.js');
            return await (mod.default || mod)(req, res);
          }
        } catch (apiErr: any) {
          console.error('[Vite API Proxy Error]:', apiErr);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: apiErr.message }));
          return;
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
      cors: true,
      allowedHosts: true,
      hmr: false,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
          }
        }
      }
    },
  };
});
