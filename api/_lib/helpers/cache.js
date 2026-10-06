const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000;

export function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.ts < item.ttl) return item.data;
  cache.delete(key);
  return null;
}

export function setCached(key, data, ttl = DEFAULT_TTL) {
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { ts: Date.now(), data, ttl });
}
