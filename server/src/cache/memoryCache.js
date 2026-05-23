import { CACHE_TTL_MS } from '../config.js';

export class MemoryCache {
    constructor(ttlMs = CACHE_TTL_MS) {
        this.ttlMs = ttlMs;
        this.store = new Map();
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    size() {
        return this.store.size;
    }
}

export const resolveCache = new MemoryCache();
