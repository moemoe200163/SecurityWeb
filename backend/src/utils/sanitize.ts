const SENSITIVE_KEYS = [
  'password', 'token', 'cookie', 'auth', 'apikey', 'api_key',
  'secret', 'credential', 'authorization', 'session',
];

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
