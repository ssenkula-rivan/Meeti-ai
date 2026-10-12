import { describe, it, expect } from 'vitest';
import { flagEnabled } from './feature-flags';

describe('feature flags', () => {
  it('is OFF by default when the env var is absent', () => {
    expect(flagEnabled('RECORDING_CONSENT', {})).toBe(false);
  });

  it('is ON only for "true" or "1" (case/space tolerant)', () => {
    expect(flagEnabled('TOKEN_ROTATION', { FEATURE_TOKEN_ROTATION: 'true' })).toBe(true);
    expect(flagEnabled('TOKEN_ROTATION', { FEATURE_TOKEN_ROTATION: '1' })).toBe(true);
    expect(flagEnabled('TOKEN_ROTATION', { FEATURE_TOKEN_ROTATION: ' TRUE ' })).toBe(true);
  });

  it('treats anything else as OFF, never throwing', () => {
    for (const v of ['false', '0', '', 'yes', 'on', 'null']) {
      expect(flagEnabled('CONFIDENCE_HIGHLIGHT', { FEATURE_CONFIDENCE_HIGHLIGHT: v })).toBe(false);
    }
  });
});
