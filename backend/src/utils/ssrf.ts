/**
 * SSRF guard — reject user-supplied hosts that resolve to private/loopback
 * /link-local/multicast IP ranges, plus obvious IP-literal short-circuits.
 *
 * Why we need this:
 *  - pentest `/assist` accepts an arbitrary `target` and `url`. Today the
 *    simulation path is local-only, but the schema is already a future
 *    SSRF interface; lock it down now while the change is cheap.
 *  - settings LLM provider `baseUrl` is admin-only but still worth gating
 *    so a stolen admin key cannot pivot the LLM traffic to an internal
 *    address (which would exfiltrate messages/raw_content through the
 *    outbound request body).
 *
 * The list of blocked ranges mirrors the OWASP SSRF cheat-sheet plus
 * IPv6 ULA/link-local. We block IPv4 mapped IPv6 addresses too.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
  resolvedIp?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // Common metadata endpoints — also useful to block by name even if DNS
  // somehow leaks them.
  'metadata.google.internal',
  'metadata',
]);

/**
 * Test whether an IPv4 or IPv6 string is in a private/reserved range that
 * should never be reachable from a user-supplied target.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 fast path
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // 224.0.0.0/4 multicast + 240/4 reserved
    return false;
  }

  // IPv6: most everything except global unicast is risky
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback, unspecified
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('ff')) return true; // multicast
    // IPv4-mapped IPv6: ::ffff:10.0.0.1 — extract and recheck
    const mapped = lower.match(/^::ffff:([0-9a-f.:]+)$/);
    if (mapped && mapped[1]) {
      return isPrivateOrReservedIp(mapped[1]);
    }
    return false;
  }

  // Unparseable: treat as private to fail closed.
  return true;
}

/**
 * Resolve the host (using Node's resolver, which honors /etc/hosts on
 * Linux) and check every answer. If any answer is private, reject.
 *
 * `allowPrivate` is for tests that explicitly need to hit localhost.
 */
export async function checkSsrf(
  input: string,
  options: { allowPrivate?: boolean; label?: string } = {},
): Promise<SsrfCheckResult> {
  const label = options.label ?? 'target';
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: `${label} is empty` };
  }

  // Accept either a bare host or a full URL. If a URL, check the host part.
  let host: string;
  let isLiteral = false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.includes('://')) {
    try {
      const u = new URL(trimmed);
      host = u.hostname;
    } catch {
      return { ok: false, reason: `${label} is not a valid URL` };
    }
  } else {
    host = trimmed;
  }

  if (!host) {
    return { ok: false, reason: `${label} has no host` };
  }

  // Reject obvious junk hostnames up front.
  if (BLOCKED_HOSTNAMES.has(host.toLowerCase())) {
    return { ok: false, reason: `${label} host is blocked` };
  }
  if (host.length > 253) {
    return { ok: false, reason: `${label} host too long` };
  }

  // If the host is an IP literal, we don't need DNS — just check.
  if (net.isIP(host)) {
    if (!options.allowPrivate && isPrivateOrReservedIp(host)) {
      return { ok: false, reason: `${label} IP is in a private/reserved range`, resolvedIp: host };
    }
    return { ok: true, resolvedIp: host };
  }
  isLiteral = true; // suppress unused warning under noUnusedLocals

  // DNS lookup; reject if any answer is private.
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch (err) {
    return { ok: false, reason: `${label} DNS lookup failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (addrs.length === 0) {
    return { ok: false, reason: `${label} DNS returned no addresses` };
  }

  for (const a of addrs) {
    if (!options.allowPrivate && isPrivateOrReservedIp(a.address)) {
      return {
        ok: false,
        reason: `${label} resolves to private/reserved address ${a.address}`,
        resolvedIp: a.address,
      };
    }
  }

  return { ok: true, resolvedIp: addrs[0]?.address };
}
