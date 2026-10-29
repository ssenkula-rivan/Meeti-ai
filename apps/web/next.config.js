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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
