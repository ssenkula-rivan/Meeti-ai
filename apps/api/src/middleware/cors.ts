/**
 * CORS origin decision extracted into a pure function so the allowlist can be
 * unit-tested without booting Express. Keeping the logic here (rather than
 * inline in index.ts) means the security-critical "who may call this API
 * cross-origin" rule has direct test coverage.
 */

/**
 * A request is allowed when:
 *  - it carries no Origin header (native iOS/Android apps, curl, server-to-
 *    server, same-origin simple requests), OR
 *  - its exact origin is present in the allowlist.
 *
 * Matching is exact and case-sensitive on purpose: browsers normalise the
 * scheme/host of the Origin header to lowercase before sending it, and the
 * allowlist is authored lowercase, so any deviation should be denied.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

/**
 * The delegate shape expected by the `cors` package's `origin` option. Returns
 * an Error for disallowed origins so the middleware rejects the preflight.
 */
export function corsOriginDelegate(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ): void => {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  };
}
