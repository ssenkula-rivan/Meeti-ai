import { SITE } from '@/lib/site-config';

// Serves /.well-known/security.txt. The contact address comes from the same
// config as the rest of the legal copy, so it stays [SET: ...] until filled.
export function GET() {
  const body = [
    'Contact: ' + SITE.legal.securityEmail,
    'Preferred-Languages: en',
    'Canonical: https://meeti.org.uk/.well-known/security.txt',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
