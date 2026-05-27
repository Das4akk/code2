import { Router } from 'express';
import { resolveMedia } from '../mediaResolver.js';
import { listSupportedPlatforms } from '../extractors/index.js';
import { MAX_BODY_BYTES } from '../config.js';

export const mediaRouter = Router();

mediaRouter.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'cowio-media-resolver' });
});

mediaRouter.get('/platforms', (_req, res) => {
    res.json({ platforms: listSupportedPlatforms() });
});

mediaRouter.post('/resolve-media', async (req, res) => {
    const rawBody = JSON.stringify(req.body || {});
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
        return res.status(413).json({
            success: false,
            error: 'Request body too large',
            code: 'INVALID_URL'
        });
    }

    const url = req.body?.url;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Field "url" is required',
            code: 'INVALID_URL'
        });
    }

    try {
        const data = await resolveMedia(url);
        return res.json(data);
    } catch (err) {
        const code = err.code || 'EXTRACTION_FAILED';
        const status = code === 'INVALID_URL' ? 400
            : code === 'UNSUPPORTED_URL' ? 422
            : code === 'TIMEOUT' ? 504
            : 400;

        return res.status(status).json({
            success: false,
            error: err.message || 'Extraction failed',
            code
        });
    }
});
