import dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

const PRIVATE_IP_REGEXES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
  /^198\.(1[8-9])\./,
  /^224\./,
  /^240\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
]);

function isPrivateIp(ip) {
  if (!ip) return false;
  return PRIVATE_IP_REGEXES.some((reg) => reg.test(ip));
}

export async function validateUrl(rawUrl, options = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Empty or invalid URL string' };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only http and https protocols are supported' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: 'Access to local/internal hostnames is blocked' };
  }

  if (isPrivateIp(hostname)) {
    return { valid: false, error: 'Access to private IP addresses is blocked' };
  }

  // DNS lookup verification to prevent DNS rebinding
  try {
    const lookup = await lookupAsync(hostname, { all: true });
    if (lookup && lookup.length > 0) {
      for (const entry of lookup) {
        if (isPrivateIp(entry.address)) {
          return { valid: false, error: 'Resolved address points to a private network' };
        }
      }
    }
  } catch (err) {
    // If DNS resolution fails, allow if not an explicitly blocked hostname (or will fail on fetch)
  }

  return { valid: true, url: parsed };
}

export async function safeFetch(url, options = {}) {
  const validation = await validateUrl(typeof url === 'string' ? url : url.toString(), options);
  if (!validation.valid) {
    throw new Error(validation.error || 'Blocked by SSRF protection');
  }

  const timeoutMs = options.timeout || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  validateUrl,
  safeFetch,
};
