import dns from 'dns';
import net from 'net';

/**
 * Default Whitelist of allowed video & media provider domains
 */
export const ALLOWED_MEDIA_DOMAINS: string[] = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'rutube.ru',
  'www.rutube.ru',
  'vk.com',
  'www.vk.com',
  'vkvideo.ru',
  'www.vkvideo.ru',
  'vimeo.com',
  'www.vimeo.com'
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
  'metadata',
  'metadata.google.internal.'
]);

/**
 * Checks if a given IP address belongs to private, loopback, or cloud-metadata ranges.
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim().toLowerCase();

  // IPv4-mapped IPv6 check
  if (cleanIp.startsWith('::ffff:')) {
    const ipv4Part = cleanIp.slice(7);
    return isPrivateIp(ipv4Part);
  }

  // IPv6 Checks
  if (net.isIPv6(cleanIp)) {
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return true;
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;
    // fc00::/7 (Unique Local Address)
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp)) return true;
    // fe80::/10 (Link-Local Address)
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIp)) return true;
    return false;
  }

  // IPv4 Checks
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // malformed IPv4 -> treat as unsafe
    }

    const [o0, o1, o2] = parts as [number, number, number, number];

    // 0.0.0.0/8 (Current network)
    if (o0 === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (o0 === 10) return true;
    // 100.64.0.0/10 (Shared address / CGNAT)
    if (o0 === 100 && o1 >= 64 && o1 <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (o0 === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (o0 === 169 && o1 === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.0.0 – 172.31.255.255)
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (o0 === 192 && o1 === 0 && o2 === 0) return true;
    // 192.0.2.0/24 (Documentation / TEST-NET-1)
    if (o0 === 192 && o1 === 0 && o2 === 2) return true;
    // 192.168.0.0/16 (Private network)
    if (o0 === 192 && o1 === 168) return true;
    // 198.18.0.0/15 (Network benchmark tests)
    if (o0 === 198 && (o1 === 18 || o1 === 19)) return true;
    // 198.51.100.0/24 (Documentation / TEST-NET-2)
    if (o0 === 198 && o1 === 51 && o2 === 100) return true;
    // 203.0.113.0/24 (Documentation / TEST-NET-3)
    if (o0 === 203 && o1 === 0 && o2 === 113) return true;
    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (o0 >= 224 && o0 <= 239) return true;
    // 240.0.0.0/4 (Reserved / Future Use)
    if (o0 >= 240) return true;

    return false;
  }

  // Not a recognizable valid public IP
  return true;
}

/**
 * Checks if a hostname matches the domain whitelist.
 */
export function isDomainAllowed(hostname: string, allowedDomains: string[] = ALLOWED_MEDIA_DOMAINS): boolean {
  const normHost = hostname.toLowerCase().trim().replace(/\.$/, '');

  for (const domain of allowedDomains) {
    const normDomain = domain.toLowerCase().trim();
    if (normHost === normDomain || normHost.endsWith('.' + normDomain)) {
      return true;
    }
  }

  return false;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
  resolvedIps?: string[];
}

/**
 * Validates a user-provided URL against protocol, hostname blacklist, domain whitelist,
 * and performs DNS lookup to prevent DNS-rebinding and SSRF to internal/private IPs.
 */
export async function validateUrl(
  rawUrl: string,
  options?: { allowedDomains?: string[]; enforceWhitelist?: boolean }
): Promise<ValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed or invalid URL format' };
  }

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol ${parsed.protocol} is not permitted. Only http: and https: are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Hostname blacklist checks
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return { valid: false, error: `Access to hostname "${hostname}" is forbidden (SSRF protection).` };
  }

  // If host is directly an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, error: `Access to private or local IP address ${hostname} is blocked.` };
    }
  }

  // Domain whitelist check (default enabled for media services)
  const enforceWhitelist = options?.enforceWhitelist !== false;
  const allowedDomains = options?.allowedDomains || ALLOWED_MEDIA_DOMAINS;

  if (enforceWhitelist && !isDomainAllowed(hostname, allowedDomains)) {
    return {
      valid: false,
      error: `Domain "${hostname}" is not in the allowed media whitelist.`
    };
  }

  // DNS resolution & anti-DNS rebinding check
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { valid: false, error: `DNS lookup failed for hostname "${hostname}".` };
    }

    const resolvedIps = lookupResults.map((r) => r.address);
    for (const ip of resolvedIps) {
      if (isPrivateIp(ip)) {
        return {
          valid: false,
          error: `DNS resolution for "${hostname}" pointed to blocked private/local IP ${ip}.`
        };
      }
    }

    return { valid: true, url: parsed, resolvedIps };
  } catch (dnsErr: any) {
    return {
      valid: false,
      error: `Unable to resolve hostname "${hostname}": ${dnsErr.message || 'DNS error'}`
    };
  }
}

export interface SafeFetchOptions extends RequestInit {
  allowedDomains?: string[];
  enforceWhitelist?: boolean;
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * Safely fetches a remote resource with SSRF protection, DNS rebinding mitigation,
 * timeout enforcement (5 seconds default), and validated redirect tracing.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    const validation = await validateUrl(currentUrl, {
      allowedDomains: options.allowedDomains,
      enforceWhitelist: options.enforceWhitelist
    });

    if (!validation.valid || !validation.url) {
      throw new Error(`[SSRF Blocked] ${validation.error || 'Invalid or forbidden URL'}`);
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOpts: RequestInit = {
        ...options,
        redirect: 'manual', // Manually inspect redirects to validate target location!
        signal: controller.signal
      };

      const response = await fetch(validation.url.toString(), fetchOpts);

      // Handle redirects manually to prevent SSRF through 30x bounces
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const locationHeader = response.headers.get('location');
        if (!locationHeader) {
          return response;
        }

        redirectsCount++;
        if (redirectsCount > maxRedirects) {
          throw new Error('[SSRF Blocked] Exceeded maximum allowed redirects (3).');
        }

        // Resolve relative redirect against currentUrl
        const resolvedRedirect = new URL(locationHeader, validation.url).toString();
        currentUrl = resolvedRedirect;
        continue;
      }

      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`[SafeFetch Timeout] Request to "${currentUrl}" timed out after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error('[SSRF Blocked] Too many redirects.');
}
