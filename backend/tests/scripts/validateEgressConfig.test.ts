import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateEgressConfig } from '../../src/scripts/validateEgressConfig.js';

function tmpFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'egress-test-'));
  const path = join(dir, 'egress.conf');
  writeFileSync(path, content);
  return path;
}

describe('validateEgressConfig', () => {
  it('accepts valid config', () => {
    const p = tmpFile(JSON.stringify({
      allow: [{ cidr: '10.0.0.0/8', ports: [80, 443], proto: 'tcp' }],
      allowIcmp: false,
    }));
    expect(validateEgressConfig(p).ok).toBe(true);
  });

  it('rejects 0.0.0.0/0', () => {
    const p = tmpFile(JSON.stringify({
      allow: [{ cidr: '0.0.0.0/0', ports: [443], proto: 'tcp' }],
    }));
    const r = validateEgressConfig(p);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid CIDR', () => {
    const p = tmpFile(JSON.stringify({
      allow: [{ cidr: 'not-a-cidr', ports: [443], proto: 'tcp' }],
    }));
    const r = validateEgressConfig(p);
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range port', () => {
    const p = tmpFile(JSON.stringify({
      allow: [{ cidr: '10.0.0.0/8', ports: [70000], proto: 'tcp' }],
    }));
    const r = validateEgressConfig(p);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid proto', () => {
    const p = tmpFile(JSON.stringify({
      allow: [{ cidr: '10.0.0.0/8', ports: [443], proto: 'http' }],
    }));
    const r = validateEgressConfig(p);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const p = tmpFile('{not json');
    const r = validateEgressConfig(p);
    expect(r.ok).toBe(false);
  });
});
