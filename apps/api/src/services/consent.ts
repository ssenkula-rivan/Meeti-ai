import { flagEnabled } from './feature-flags';

// Server-side recording-consent logic. Enforcement is gated by the
// FEATURE_RECORDING_CONSENT flag (default OFF) so existing behaviour is
// unchanged until it is enabled.

export function recordingConsentRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return flagEnabled('RECORDING_CONSENT', env);
}

export interface ConsentState {
  consent_confirmed?: boolean;
}

// True when consent is required but the meeting has not had it confirmed.
export function consentMissing(
  meeting: ConsentState | null | undefined,
  required: boolean,
): boolean {
  return required && !meeting?.consent_confirmed;
}
