const SENSITIVE_KEYS = [
  'password', 'token', 'cookie', 'auth', 'apikey', 'api_key',
  'secret', 'credential', 'authorization', 'session',
];

/**
 * Patterns that, when found in a free-form error string, indicate the
 * message may carry credentials or internal hostnames. We trim those
 * out before logging the error to the server (which may be shipped to
 * log aggregators) or echoing it to the client.
 */
const ERROR_SCRUB_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // looks like an API key
  { pattern: /\bsk-[a-f0-9]{8,}/gi, replacement: 'sk-***REDACTED***' },
  // bearer / basic auth
  { pattern: /(?:bearer|basic)\s+[a-z0-9._\-+/=]{8,}/gi, replacement: '$1 ***REDACTED***' },
  // http(s)://user:pass@host
  { pattern: /https?:\/\/[^/\s:]+:[^/\s@]+@/gi, replacement: 'https://***@' },
];

/**
 * Redact credentials / hostnames from an error message. Returns
 * `'(internal error)'` when the message looks like a generic Error
 * (we want the type but not the internals).
 */
export function sanitizeErrorMessage(message: string, opts: { production: boolean } = { production: false }): string {
  let out = message;
  for (const { pattern, replacement } of ERROR_SCRUB_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  // In production, drop everything that smells like an internal stack
  // frame or Prisma client error. We still log the *full* message to
  // the server log via fastify.request.log below — this scrubbed
  // version is what callers see in their `details` field.
  if (opts.production) {
    if (
      out.includes('Prisma') ||
      out.includes('node:') ||
      out.includes('at Object.') ||
      out.includes('at async ')
    ) {
      return '(internal error)';
    }
  }
  return out;
}

export function sanitizeAuditDetails(details: Record<string, unknown>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
        return [key, '[REDACTED]'];
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return [key, sanitizeAuditDetails(value as Record<string, unknown>)];
      }
      return [key, value];
    })
  );
}

export function sanitizeCommand(command: unknown[]): any[] {
  return command.map((arg) => {
    if (typeof arg === 'string') {
      const lowerArg = arg.toLowerCase();
      if (SENSITIVE_KEYS.some(sensitive => lowerArg.includes(sensitive))) {
        return '[REDACTED]';
      }
    }
    return arg;
  });
}
