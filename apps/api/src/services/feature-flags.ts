// Environment-based feature flags (server-side only).
//
// Rules:
//  - A flag is ON only when its env var equals "true" or "1"; anything else
//    (unset, empty, "false", typos) is OFF. Risky features therefore default OFF.
//  - Flags gate behaviour only. Never put secrets or config values in a flag.
//  - These are read on the server; do not forward their raw values to the browser.
//
// Documented flags:
//  FEATURE_RECORDING_CONSENT    - require an in-app consent step before recording
//                                 or uploading meeting audio (Phase 1, task 7).
//  FEATURE_TOKEN_ROTATION       - issue short access tokens + refreshable,
//                                 revocable sessions alongside the legacy JWT
//                                 (Phase 1, task 5).
//  FEATURE_CONFIDENCE_HIGHLIGHT - surface the estimated transcript-confidence
//                                 indicator in the transcript UI (Phase 2).

export type FlagName =
  | 'RECORDING_CONSENT'
  | 'TOKEN_ROTATION'
  | 'CONFIDENCE_HIGHLIGHT';

const TRUTHY = new Set(['true', '1']);

export function flagEnabled(name: FlagName, env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[`FEATURE_${name}`];
  return typeof value === 'string' && TRUTHY.has(value.trim().toLowerCase());
}
