/**
 * API key hashing utilities.
 *
 * Keys follow the format: "sk-" + 64-char hex = 67 chars total.
 * Storage uses:
 *   - keyPrefix: first 11 chars ("sk-" + 8 hex) for fast DB lookup
 *   - hashedKey: SHA-256 hex digest of the full 67-char key
 *
 * The plaintext key is returned ONCE on generation and never stored.
 */
import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX_LENGTH = 11; // "sk-" (3) + 8 hex chars
const KEY_TOTAL_LENGTH = 67;  // "sk-" (3) + 64 hex chars

/**
 * Generate a new API key.
 * Returns the plaintext (shown once), the prefix (for DB lookup), and the hash (for storage).
 */
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  hashed: string;
} {
  const hex = randomBytes(32).toString('hex');
  const plaintext = 'sk-' + hex;
  const prefix = plaintext.slice(0, KEY_PREFIX_LENGTH);
  const hashed = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, prefix, hashed };
}

/**
 * Hash an existing API key (for storage or verification).
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the lookup prefix from a full API key.
 */
export function extractPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX_LENGTH);
}

/**
 * Validate API key format: must start with "sk-" and be 67 chars total.
 */
export function isValidKeyFormat(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.length === KEY_TOTAL_LENGTH &&
    key.startsWith('sk-')
  );
}
