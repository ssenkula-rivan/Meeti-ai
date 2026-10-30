import { describe, it, expect, vi } from 'vitest';
import { isAllowedOrigin, corsOriginDelegate } from './cors';

const ALLOW = ['https://meeti.org.uk', 'http://localhost:3000'];

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin (native apps, curl, server-to-server)', () => {
    expect(isAllowedOrigin(undefined, ALLOW)).toBe(true);
    expect(isAllowedOrigin('', ALLOW)).toBe(true);
  });

  it('allows an exact allowlisted origin', () => {
    expect(isAllowedOrigin('https://meeti.org.uk', ALLOW)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000', ALLOW)).toBe(true);
  });

  it('denies origins not in the allowlist, including suffix-spoof attempts', () => {
    expect(isAllowedOrigin('https://evil.example.com', ALLOW)).toBe(false);
    expect(isAllowedOrigin('https://meeti.org.uk.evil.com', ALLOW)).toBe(false);
  });

  it('matches exactly (case-sensitive, no trim) — config trims upstream', () => {
    expect(isAllowedOrigin('https://MEETI.ORG.UK', ALLOW)).toBe(false);
    expect(isAllowedOrigin(' https://meeti.org.uk', ALLOW)).toBe(false);
  });

  it('denies every browser origin when the allowlist is empty, still allows non-browser', () => {
    expect(isAllowedOrigin('https://meeti.org.uk', [])).toBe(false);
    expect(isAllowedOrigin(undefined, [])).toBe(true);
  });
});

describe('corsOriginDelegate', () => {
  it('calls back (null, true) for an allowed origin', () => {
    const cb = vi.fn();
    corsOriginDelegate(ALLOW)('https://meeti.org.uk', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('calls back with an Error (and no allow flag) for a disallowed origin', () => {
    const cb = vi.fn();
    corsOriginDelegate(ALLOW)('https://evil.example.com', cb);
    const [err, allow] = cb.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/CORS/);
    expect(allow).toBeUndefined();
  });
});
