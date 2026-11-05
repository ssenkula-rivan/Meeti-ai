/**
 * At-rest encryption for secrets stored in the database (OAuth access/refresh
 * tokens). AES-256-GCM provides both confidentiality and integrity (auth tag),
 * so a tampered ciphertext fails to decrypt instead of returning garbage.
 *
 * Format:  gcm$<base64 iv(12B)>.<base64 authTag(16B)>.<base64 ciphertext>
 *
 * Backward compatibility: rows written before encryption was introduced hold
 * raw plaintext. decryptSecret() returns any value without the `gcm$` prefix
 * unchanged, so legacy rows keep working until they are naturally re-encrypted
 * on the next token refresh / reconnection (which encrypts on write).
 *
 * The key is read lazily from config so it can be rotated / injected in tests,
 * and so a missing key fails CLOSED (throws) rather than silently storing
 * plaintext.
 */
import crypto from 'crypto';
import { config } from '../config';

const PREFIX = 'gcm$';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const b64 = config.encryption.key;
  if (!b64) {
    throw new Error(
      'APP_ENCRYPTION_KEY is not configured; refusing to store secrets unencrypted.'
    );
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes (base64).');
  }
  return key;
}

/**
 * Encrypt a single secret for storage. Null/undefined/empty are returned
 * unchanged so nullable columns (e.g. refresh_token) stay null, and a value
 * that is already encrypted is returned as-is (idempotent).
 */
export function encryptSecret(plain: string): string;
export function encryptSecret(plain: null | undefined): null | undefined;
export function encryptSecret(plain: string | null | undefined): string | null | undefined;
export function encryptSecret(plain: string | null | undefined): string | null | undefined {
  if (plain === null || plain === undefined) return plain;
  if (typeof plain !== 'string' || plain.length === 0) return plain;
  if (plain.startsWith(PREFIX)) return plain; // already encrypted

  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Decrypt a stored secret. Values without the `gcm$` prefix are treated as
 * legacy plaintext and returned unchanged.
 */
export function decryptSecret(stored: string): string;
export function decryptSecret(stored: null | undefined): null | undefined;
export function decryptSecret(stored: string | null | undefined): string | null | undefined;
export function decryptSecret(stored: string | null | undefined): string | null | undefined {
  if (stored === null || stored === undefined) return stored;
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) {
    return stored; // legacy plaintext passthrough
  }

  const key = getKey();
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split('.');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed encrypted secret.');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
