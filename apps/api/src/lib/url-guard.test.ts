import { describe, it, expect } from 'vitest';
import { validateOutboundUrl } from './url-guard';

// validateOutboundUrl returns null when a URL is safe for server-side delivery,
// or a human-readable reason string when it must be blocked (SSRF defence).
describe('validateOutboundUrl (SSRF guard)', () => {
  describe('blocks dangerous and internal targets', () => {
    const blocked = [
      'http://169.254.169.254/latest/meta-data/iam/', // EC2 metadata (primary threat)
      'http://169.254.1.1', // link-local
      'http://127.0.0.1:3000/api', // IPv4 loopback
      'http://localhost/webhook', // loopback hostname
      'http://api.localhost/webhook', // *.localhost
      'http://10.0.0.5/internal', // 10/8 private
      'http://172.16.0.1/internal', // 172.16/12 private
      'http://172.31.255.255/internal', // 172.16/12 upper bound
      'http://192.168.1.1/admin', // 192.168/16 private
      'http://0.0.0.0/', // "this" network
      'http://100.64.0.1/', // CGNAT 100.64/10
      'http://198.18.0.1/', // benchmark 198.18/15
      'http://224.0.0.1/', // multicast
      'http://255.255.255.255/', // reserved / limited broadcast
      'http://metadata.google.internal/', // GCP metadata hostname
      'http://db.internal:5432/', // *.internal
      'http://[::1]/', // IPv6 loopback
      'http://[fd00::1]/', // IPv6 unique local (fc00::/7)
      'http://[fe80::1]/', // IPv6 link-local
      'http://[::ffff:169.254.169.254]/', // IPv4-mapped IPv6 -> metadata
      'file:///etc/passwd', // non-http scheme
      'ftp://internal/secret', // non-http scheme
      'gopher://127.0.0.1:6379/', // non-http scheme (redis via gopher)
      'not a url', // unparseable
    ];

    for (const url of blocked) {
      it(`blocks ${url}`, () => {
        expect(validateOutboundUrl(url)).toBeTypeOf('string');
      });
    }
  });

  describe('allows legitimate public endpoints', () => {
    const allowed = [
      'https://example.com/webhook',
      'https://hooks.slack.com/services/T00000/B00000/XXXX',
      'http://93.184.216.34/webhook', // public IPv4 literal (example.com)
      'https://[2606:4700:4700::1111]/webhook', // public IPv6 literal
      'https://sub.domain.co.uk:8443/a/b?c=d#frag',
    ];

    for (const url of allowed) {
      it(`allows ${url}`, () => {
        expect(validateOutboundUrl(url)).toBeNull();
      });
    }
  });

  it('distinguishes 172.16 (private) from 172.15 (public)', () => {
    expect(validateOutboundUrl('http://172.15.0.1/')).toBeNull();
    expect(validateOutboundUrl('http://172.16.0.1/')).toBeTypeOf('string');
  });

  it('distinguishes 100.64 (CGNAT) from 100.63 (public)', () => {
    expect(validateOutboundUrl('http://100.63.0.1/')).toBeNull();
    expect(validateOutboundUrl('http://100.64.0.1/')).toBeTypeOf('string');
  });
});
