import { readFileSync } from 'fs';
import { z } from 'zod';

const CIDR_RE = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/;

const cidrSchema = z.string().regex(CIDR_RE, 'Invalid IPv4 CIDR').refine(
  (cidr) => cidr !== '0.0.0.0/0',
  { message: '0.0.0.0/0 is forbidden in egress whitelist' }
);

const tcpUdpRule = z.object({
  cidr: cidrSchema,
  ports: z.array(z.number().int().min(1).max(65535)).min(1),
  proto: z.enum(['tcp', 'udp']),
});

const icmpRule = z.object({
  cidr: cidrSchema,
  ports: z.array(z.number().int()).optional(),
  proto: z.literal('icmp'),
});

const ruleSchema = z.discriminatedUnion('proto', [tcpUdpRule, icmpRule]);

const configSchema = z.object({
  allow: z.array(ruleSchema).max(100),
  allowIcmp: z.boolean().optional().default(false),
});

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateEgressConfig(path: string): ValidationResult {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (e) {
    return { ok: false, errors: [`Cannot read file: ${(e as Error).message}`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  const r = configSchema.safeParse(parsed);
  if (!r.success) {
    return { ok: false, errors: r.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`) };
  }
  return { ok: true };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: validate-egress-config <path>');
    process.exit(2);
  }
  const result = validateEgressConfig(path);
  if (result.ok) {
    console.log('OK');
    process.exit(0);
  }
  console.error('FAIL:');
  for (const err of result.errors) console.error(`  ${err}`);
  process.exit(1);
}
