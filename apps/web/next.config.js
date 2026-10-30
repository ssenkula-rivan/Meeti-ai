/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@meeti/database'],
  // Security headers are set here (not via public/_headers) because on the
  // OpenNext Cloudflare Worker the HTML routes are produced by the server
  // function, so Workers Assets never applies _headers to them. This runs on
  // every rendered response.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)' },
          // Content-Security-Policy is shipped in REPORT-ONLY mode on purpose.
          // The App Router emits dynamic inline hydration scripts (plus the
          // theme-init script in layout.tsx), so an ENFORCING policy would need
          // per-request nonces (Next `experimental.csp` + a Worker middleware)
          // before it can be turned on without breaking the UI. Report-Only is
          // inert (blocks nothing) while we validate the exact policy below.
          // See issue #68 for the enforcement rollout plan.
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.meeti.org.uk; media-src 'self' blob: data:; upgrade-insecure-requests",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
