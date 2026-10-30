import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * config.ts is evaluated for its side effects (it builds the config object and
 * enforces the production JWT guard at import time). To exercise those guards
 * we reset the module registry and re-import with a controlled process.env.
 * There is no committed .env, so dotenv.config() loads nothing and our values
 * win.
 */
const SNAPSHOT = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  const mod = await import('./config');
  return mod.config;
}

describe('config security guards', () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.ALLOWED_ORIGINS;
  });
  afterEach(() => {
    process.env = { ...SNAPSHOT };
  });

  it('FAILS CLOSED in production when JWT_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    await expect(loadConfig()).rejects.toThrow(/JWT_SECRET must be set in production/);
  });

  it('loads in production when a real JWT_SECRET is provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-signing-secret';
    const config = await loadConfig();
    expect(config.jwt.secret).toBe('a-real-signing-secret');
    expect(config.nodeEnv).toBe('production');
  });

  it('does not throw outside production even with the placeholder key', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const config = await loadConfig();
    expect(config.jwt.secret).toBe('change-this-secret');
  });

  it('parses ALLOWED_ORIGINS into a trimmed, non-empty list', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOWED_ORIGINS = ' https://a.example , https://b.example ,,';
    const config = await loadConfig();
    expect(config.security.allowedOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falls back to the built-in allowlist when ALLOWED_ORIGINS is unset', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;
    const config = await loadConfig();
    expect(config.security.allowedOrigins).toContain('https://meeti.org.uk');
    expect(config.security.allowedOrigins.length).toBeGreaterThan(1);
  });

  it('honours numeric rate-limit overrides from env', async () => {
    process.env.NODE_ENV = 'development';
    process.env.RATE_LIMIT_MAX = '42';
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    const config = await loadConfig();
    expect(config.security.rateLimit.max).toBe(42);
    expect(config.security.rateLimit.authMax).toBe(3);
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_MAX;
  });
});
