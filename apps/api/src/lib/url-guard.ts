/**
 * SSRF guard: validate user-supplied URLs before the server makes outbound
 * requests (webhook delivery). Prevents access to internal network resources
 * (loopback, private ranges, link-local, cloud metadata endpoints).
 *
 * The primary threat on EC2 is reaching 169.254.169.254 to exfiltrate IAM
 * role credentials. Other vectors: scanning internal services on 10.x.x.x,
 * hitting management interfaces on 127.0.0.1, etc.
 *
 * Returns null if the URL is safe, or a human-readable reason string if blocked.
 */
import * as net from 'net';
import { URL } from 'url';

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if ((n >>> 24) === 0) return true; // 0.0.0.0/8 "this" network
  if ((n >>> 24) === 10) return true; // 10.0.0.0/8
  if ((n >>> 22) === (ipv4ToInt('100.64.0.0') >>> 22)) return true; // CGNAT /10
  if ((n >>> 24) === 127) return true; // loopback
  if ((n >>> 16) === (ipv4ToInt('169.254.0.0') >>> 16)) return true; // link-local (incl. EC2 metadata)
  if ((n >>> 20) === (ipv4ToInt('172.16.0.0') >>> 20)) return true; // 172.16/12
  if ((n >>> 16) === (ipv4ToInt('192.0.0.0') >>> 16)) return true; // IETF assignments
  if ((n >>> 16) === (ipv4ToInt('192.168.0.0') >>> 16)) return true; // 192.168/16
  if ((n >>> 23) === (ipv4ToInt('198.18.0.0') >>> 23)) return true; // benchmark /15
  if ((n >>> 28) === 0xe) return true; // multicast /4
  if ((n >>> 28) >= 0xf) return true; // reserved /4 (incl. 255.255.255.255)
  return false;
}

// Expand an IPv6 string (optionally bracketed) into its 8 16-bit groups,
// resolving "::" zero-compression. Returns null if it is not a valid IPv6.
function expandIPv6(ip: string): number[] | null {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower.includes(':')) return null;
  const halves = lower.split('::');
  if (halves.length > 2) return null;
  const toGroups = (s: string): number[] =>
    s ? s.split(':').map((g) => parseInt(g, 16)) : [];
  if (halves.length === 1) {
    const g = toGroups(halves[0]);
    if (g.length !== 8 || g.some((x) => Number.isNaN(x))) return null;
    return g;
  }
  const head = toGroups(halves[0]);
  const tail = toGroups(halves[1]);
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...Array(fill).fill(0), ...tail];
}

function isPrivateIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return false;
  const zeros = (arr: number[]) => arr.every((x) => x === 0);
  // :: (unspecified) and ::1 (loopback)
  if (zeros(g.slice(0, 7)) && (g[7] === 0 || g[7] === 1)) return true;
  // fc00::/7 unique-local and fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // IPv4-mapped (::ffff:x:x) and IPv4-compatible (::x:x): the upper 96 bits are
  // zero/ffff, so delegate the embedded address to the IPv4 rules. Node
  // serialises ::ffff:169.254.169.254 as ::ffff:a9fe:a9fe, so parse from hex.
  if (zeros(g.slice(0, 5)) && (g[5] === 0x0000 || g[5] === 0xffff)) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    if (isPrivateIPv4(v4)) return true;
  }
  return false;
}

/**
 * Validate a URL for safe server-side outbound delivery.
 * Returns null if safe, or a string reason if the target is blocked.
 */
export function validateOutboundUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'Invalid URL format.';
  }

  // Only HTTP(S) — block file://, ftp://, gopher:// etc.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Only http and https URLs are allowed.';
  }

  const hostname = parsed.hostname; // lowercased; brackets kept for IPv6 (WHATWG)
  if (!hostname) return 'Missing hostname.';

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.internal')
  ) {
    return 'Internal hostnames are not allowed.';
  }

  // WHATWG URL.hostname keeps the surrounding brackets for IPv6 literals
  // (e.g. "[::1]"), which net.isIP rejects; strip them so IPv6 targets reach
  // the private-range checks instead of being mistaken for a domain name.
  const hostNoBrackets = hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(hostNoBrackets);
  if (ipVersion === 4 && isPrivateIPv4(hostNoBrackets)) {
    return 'Private, loopback, link-local, or reserved IPv4 addresses are blocked.';
  }
  if (ipVersion === 6 && isPrivateIPv6(hostNoBrackets)) {
    return 'Private, loopback, link-local, or reserved IPv6 addresses are blocked.';
  }
  // ipVersion === 0 -> domain name. DNS-rebinding defence (resolve then re-check)
  // is documented as follow-up; obvious IP-literal attacks are blocked above.

  return null;
}
