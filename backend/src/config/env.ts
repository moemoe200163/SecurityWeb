/**
 * Environment variable validation.
 *
 * Called once at startup before the server begins accepting requests.
 * Required vars cause a hard exit if missing. Optional vars log a warning.
 */

const REQUIRED = ['DATABASE_URL'] as const;

const OPTIONAL = [
  'PORT',
  'ALLOWED_ORIGINS',
  'MINIMAX_API_KEY',
  'MINIMAX_API_ENDPOINT',
  'MINIMAX_MODEL',
  'ABUSEIPDB_API_KEY',
  'OTX_API_KEY',
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `\n[FATAL] Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
        'Copy .env.example to .env and fill in the values.\n',
    );
    process.exit(1);
  }

  const unset: string[] = [];
  for (const key of OPTIONAL) {
    if (!process.env[key]) {
      unset.push(key);
    }
  }

  if (unset.length > 0) {
    console.warn(
      `[WARN] Optional environment variables not set: ${unset.join(', ')}`,
    );
  }
}
