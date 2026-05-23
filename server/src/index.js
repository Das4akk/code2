import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { mediaRouter } from './routes/media.js';
import {
    PORT,
    CORS_ORIGIN,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    MAX_BODY_BYTES,
    YTDLP_PATH
} from './config.js';

const app = express();

app.disable('x-powered-by');

app.use(cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({
    limit: MAX_BODY_BYTES,
    strict: true
}));

app.use('/api', rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED'
    }
}));

app.use('/api', mediaRouter);

app.use((err, _req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON body',
            code: 'INVALID_URL'
        });
    }
    return next(err);
});

app.listen(PORT, () => {
    console.log(`[COWIO] Media resolver listening on http://localhost:${PORT}`);
    console.log(`[COWIO] yt-dlp binary: ${YTDLP_PATH}`);
    console.log(`[COWIO] POST http://localhost:${PORT}/api/resolve-media`);
});
