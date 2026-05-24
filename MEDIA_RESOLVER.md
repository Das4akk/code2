# COWIO Media Resolver (yt-dlp)

## Architecture

```
Rutube/YouTube/VK URL
        ↓
Frontend MediaResolverClient  →  POST /api/resolve-media
        ↓
Backend resolveMedia()  →  extractor  →  yt-dlp -J
        ↓
direct mp4 or m3u8 URL
        ↓
Existing native <video> + Firebase sync (unchanged)
```

## Created files

```
server/
  package.json
  .env.example
  src/
    index.js
    config.js
    mediaResolver.js
    cache/memoryCache.js
    validation/urlValidator.js
    ytdlp/ytdlpRunner.js
    ytdlp/formatSelector.js
    extractors/
      index.js
      baseExtractor.js
      rutube.js
      youtube.js
      vk.js
      vimeo.js
      twitch.js
      direct.js
    routes/media.js
```

## Modified files

- `app.js` — `MediaResolverClient`, `VideoPlaybackManager`, room save/join/sync
- `index.html` — hls.js, media API config, resolve UI states

## Requirements

- **Node.js** 18+
- **yt-dlp** (in PATH or `YTDLP_PATH`)
- **ffmpeg** (recommended for yt-dlp merge/HLS; install for best compatibility)

### Install (Windows)

```powershell
# Node dependencies
cd server
npm install

# yt-dlp (pick one)
pip install -U yt-dlp
# or
winget install yt-dlp.yt-dlp

# ffmpeg (recommended)
winget install Gyan.FFmpeg
```

### Install (Linux)

```bash
cd server && npm install
sudo pip install -U yt-dlp
# or: sudo apt install yt-dlp ffmpeg
```

## Run backend

```powershell
cd server
npm run dev
# or production:
npm start
```

Default: `http://localhost:3847`

Health: `GET http://localhost:3847/api/health`

Resolve: `POST http://localhost:3847/api/resolve-media`

```json
{ "url": "https://rutube.ru/video/..." }
```

## Frontend config

In `index.html` (or before app load):

```html
<script>window.COWIO_MEDIA_API = 'http://localhost:3847';</script>
```

For production, point to your deployed resolver host.

## Firebase room fields

| Field | Purpose |
|-------|---------|
| `videoUrl` | Playback URL (mp4/m3u8) used by `<video>` |
| `videoSourceUrl` | Original user URL (Rutube, etc.) |
| `videoPlatform` | rutube, youtube, vk, … |
| `videoIsHls` | HLS playback flag |
| `videoResolvedAt` | Re-resolve after ~12 min |
| `videoTitle` | UI label |
| `videoThumbnail` | Optional preview |

## Security

- HTTP/HTTPS only
- Blocks localhost / private IPs
- Rate limit: 30 req/min per IP (configurable)
- yt-dlp timeout: 90s
- JSON output size cap: 8 MB
- Memory cache TTL: 15 minutes

## Deployment notes

1. Run resolver as a separate service (PM2, Docker, systemd).
2. Set `CORS_ORIGIN` to your frontend origin(s).
3. Ensure `yt-dlp` and `ffmpeg` exist in server PATH.
4. Put reverse proxy (nginx) with HTTPS in front of port 3847.
5. Set `window.COWIO_MEDIA_API` to public resolver URL.

### Docker sketch

```dockerfile
FROM node:20-bookworm
RUN apt-get update && apt-get install -y ffmpeg yt-dlp && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
ENV PORT=3847
CMD ["node", "src/index.js"]
```

## HLS

If Rutube returns m3u8, playback uses **hls.js** on supported browsers; Safari may use native HLS. Sync (play/pause/seek) still uses the same `<video>` element and Firebase `rooms/{id}/sync`.
