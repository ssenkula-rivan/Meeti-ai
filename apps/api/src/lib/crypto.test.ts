import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { config } from '../config';
import { encryptSecret, decryptSecret } from './crypto';

const KEY = crypto.randomBytes(32).toString('base64');

beforeAll(() => {
  config.encryption.key = KEY;
});

describe('encryptSecret / decryptSecret (AES-256-GCM at rest)', () => {
  it('round-trips a token and hides the plaintext', () => {
    const enc = encryptSecret('ya29.access-token-value');
    expect(enc).toMatch(/^gcm\$/);
    expect(enc).not.toContain('ya29');
    expect(decryptSecret(enc)).toBe('ya29.access-token-value');
  });

  it('uses a fresh IV per call (ciphertext differs, both decrypt equal)', () => {
    const a = encryptSecret('same-value');
    const b = encryptSecret('same-value');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-value');
    expect(decryptSecret(b)).toBe('same-value');
  });

  it('is idempotent on already-encrypted values', () => {
    const once = encryptSecret('token');
    expect(encryptSecret(once)).toBe(once);
  });

  it('passes null/undefined/empty through unchanged', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeUndefined();
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeUndefined();
  });

  it('returns legacy plaintext unchanged on decrypt', () => {
    expect(decryptSecret('plain-legacy-token')).toBe('plain-legacy-token');
  });

  it('detects tampering via the GCM auth tag', () => {
    const enc = encryptSecret('important-token');
    const parts = enc.slice(4).split('.');
    const ct = Buffer.from(parts[2], 'base64');
    ct[0] = ct[0] ^ 0xff;
    parts[2] = ct.toString('base64');
    expect(() => decryptSecret('gcm$' + parts.join('.'))).toThrow();
  });

  it('fails to decrypt with a different key', () => {
    const enc = encryptSecret('token-123');
    const original = config.encryption.key;
    config.encryption.key = crypto.randomBytes(32).toString('base64');
    expect(() => decryptSecret(enc)).toThrow();
    config.encryption.key = original;
  });

  it('rejects a malformed ciphertext', () => {
    expect(() => decryptSecret('gcm$only-one-part')).toThrow();
  });

  it('throws when the key is missing (fail closed)', () => {
    const original = config.encryption.key;
    config.encryption.key = '';
    expect(() => encryptSecret('secret')).toThrow(/APP_ENCRYPTION_KEY/);
    config.encryption.key = original;
  });

  it('rejects a non-32-byte key', () => {
    const original = config.encryption.key;
    config.encryption.key = Buffer.from('too-short').toString('base64');
    expect(() => encryptSecret('secret')).toThrow(/32 bytes/);
    config.encryption.key = original;
  });
});
