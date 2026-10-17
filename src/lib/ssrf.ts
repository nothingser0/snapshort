import dns from 'node:dns/promises';
import net from 'node:net';

export interface SafeUrlResult {
  safe: boolean;
  reason?: string;
  url?: URL;
}

export function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // Link-local
    lower.startsWith('fc00:') || // Unique local address (ULA)
    lower.startsWith('fd00:') ||
    lower.startsWith('2001:db8:') || // Documentation
    lower.startsWith('100::') // Discard prefix
  ) {
    return true;
  }

  // IPv4 mapping in IPv6
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  // If it still contains colons, it is an IPv6 address that passed the private checks
  if (ip.includes(':')) {
    return false;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Broadcast/Local)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link local / AWS metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

export async function validateSafeUrl(rawUrl: string): Promise<SafeUrlResult> {
  let trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only HTTP and HTTPS protocols are supported' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, reason: 'Local domains cannot be bookmarked' };
  }

  // Check if hostname is direct IP
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: 'Private/local IP addresses are forbidden' };
    }
    return { safe: true, url: parsed };
  }

  // Resolve DNS to verify underlying IPs
  try {
    const lookup = await dns.lookup(hostname, { all: true });
    if (!lookup || lookup.length === 0) {
      return { safe: false, reason: 'Website could not be reached or domain is inactive' };
    }

    for (const record of lookup) {
      if (isPrivateIp(record.address)) {
        return { safe: false, reason: `Domain resolves to a forbidden private address: ${record.address}` };
      }
    }
  } catch {
    return { safe: false, reason: 'Website could not be reached or domain is inactive' };
  }

  return { safe: true, url: parsed };
}
