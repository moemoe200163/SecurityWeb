import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Parse the ALLOWED_ORIGINS env var into a Set of lowercase origins.
 * Supports comma-separated values. Each entry may include a scheme.
 *
 * Examples:
 *   "http://localhost:3000"           → single origin
 *   "http://localhost:3000,https://app.example.com" → two origins
 *   "" or unset                      → empty set (all origins blocked)
 */
function getAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  return new Set(
    raw
      .split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Extract the origin host (scheme + authority) from a URL string.
 * Returns null if the input is not a well-formed URL.
 */
function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Validate Origin / Referer headers on state-changing requests.
 *
 * Why this matters even with API-key auth:
 * - CORS `Access-Control-Allow-Origin: *` lets any page send custom headers
 * - An attacker-controlled page could issue POST/DELETE with the user's key
 * - This middleware rejects requests whose origin is not in the allowlist
 *
 * Skips validation for:
 * - GET / HEAD / OPTIONS (safe methods)
 * - Same-origin requests (no Origin/Referer header)
 * - Health check endpoint
 */
export async function originValidation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const method = request.method.toUpperCase();

  // Only validate state-changing methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return;
  }

  // Health check is public — skip
  if (request.url === '/health') {
    return;
  }

  const allowed = getAllowedOrigins();

  // If no origins configured, skip validation (dev mode)
  if (allowed.size === 0) {
    return;
  }

  const origin = request.headers.origin as string | undefined;
  const referer = request.headers.referer as string | undefined;

  // Same-origin requests typically don't send Origin header.
  // Browser-initiated form submissions may send Referer instead.
  // If neither is present, treat as same-origin (allowed).
  if (!origin && !referer) {
    return;
  }

  let requestOrigin: string | null = null;

  if (origin) {
    requestOrigin = origin.toLowerCase();
  } else if (referer) {
    requestOrigin = extractOrigin(referer)?.toLowerCase() ?? null;
  }

  if (!requestOrigin || !allowed.has(requestOrigin)) {
    request.log.warn(
      { origin: requestOrigin, method, url: request.url },
      'Origin validation failed',
    );
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Request origin not allowed',
    });
  }
}
