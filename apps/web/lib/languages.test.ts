import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  AUTO_DETECT,
  getLanguage,
  isSupported,
  needsBetaBadge,
} from './languages';

describe('language support config', () => {
  it('supports auto-detect and known codes, rejects unknown', () => {
    expect(isSupported(AUTO_DETECT)).toBe(true);
    expect(isSupported('en')).toBe(true);
    expect(isSupported('xx')).toBe(false);
  });

  it('every entry has a valid status, a fallback, and a code that fits the DB column', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(['stable', 'beta', 'unsupported']).toContain(lang.status);
      expect(lang.fallback.length).toBeGreaterThan(0);
      expect(lang.code.length).toBeLessThanOrEqual(10);
    }
  });

  it('nothing is marked stable yet (promotion requires real-audio validation)', () => {
    const stable = SUPPORTED_LANGUAGES.filter((l) => l.status === 'stable');
    expect(stable).toEqual([]);
  });

  it('flags beta languages for a badge', () => {
    const en = getLanguage('en');
    expect(en).toBeDefined();
    expect(needsBetaBadge(en!)).toBe(true);
  });
});
