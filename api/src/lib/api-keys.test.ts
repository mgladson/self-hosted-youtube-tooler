import { describe, it, expect } from 'vitest';
import { generateSecret, hashSecret, displayPrefix } from './api-keys.js';

describe('generateSecret', () => {
  it('is prefixed with sk_live_ and carries url-safe entropy', () => {
    const secret = generateSecret();
    expect(secret.startsWith('sk_live_')).toBe(true);
    // sk_live_ (8) + 32 base64url chars
    expect(secret.length).toBe(8 + 32);
    expect(secret.slice(8)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is unique across calls', () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateSecret()));
    expect(seen.size).toBe(100);
  });
});

describe('hashSecret', () => {
  it('is a deterministic 64-char sha256 hex digest', () => {
    const secret = 'sk_live_abcdef0123456789';
    const hash = hashSecret(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret(secret)).toBe(hash);
  });

  it('differs for different secrets', () => {
    expect(hashSecret('sk_live_aaa')).not.toBe(hashSecret('sk_live_bbb'));
  });

  it('does not contain the raw secret', () => {
    const secret = generateSecret();
    expect(hashSecret(secret)).not.toContain(secret.slice(8));
  });
});

describe('displayPrefix', () => {
  it('exposes only the prefix plus a few identifying chars', () => {
    const secret = generateSecret();
    const prefix = displayPrefix(secret);
    expect(prefix.startsWith('sk_live_')).toBe(true);
    expect(prefix.length).toBe(8 + 6);
    expect(secret.startsWith(prefix)).toBe(true);
  });
});
