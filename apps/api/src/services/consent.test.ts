import { describe, it, expect } from 'vitest';
import { recordingConsentRequired, consentMissing } from './consent';

describe('recording consent', () => {
  it('is not required unless the flag is on', () => {
    expect(recordingConsentRequired({})).toBe(false);
    expect(recordingConsentRequired({ FEATURE_RECORDING_CONSENT: 'true' })).toBe(true);
  });

  it('reports missing consent only when required and not confirmed', () => {
    expect(consentMissing({ consent_confirmed: false }, true)).toBe(true);
    expect(consentMissing({ consent_confirmed: true }, true)).toBe(false);
    expect(consentMissing(null, true)).toBe(true);
  });

  it('never blocks when the flag is off', () => {
    expect(consentMissing({ consent_confirmed: false }, false)).toBe(false);
    expect(consentMissing(null, false)).toBe(false);
  });
});
