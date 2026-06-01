import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    CORS_ORIGIN,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    MAX_BODY_BYTES
} from './src/config.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('trust proxy', 1);
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

// API temporary disabled due to missing files in repo
app.get('/api/resolve-media', (req, res) => {
    res.status(500).json({ error: 'Backend media resolver not found' });
});

const publicPath = __dirname;
app.use(express.static(publicPath, { index: false })); // avoid index.html auto serving first if we want specific rules, or just allow it
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.use((err, req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        });
    }
    return next(err);
});

const finalPort = 3000;
app.listen(finalPort, '0.0.0.0', () => {
    console.log(`[COWIO] Server listening on http://0.0.0.0:${finalPort}`);
});
