// Canonical language support table — the single source of truth for the
// recording-language picker, beta badges and the marketing claims.
//
// Honesty rule: nothing here is labelled "stable" until it has been validated
// against real meeting audio for this deployment (blocked on transcription
// credits). Everything currently offered is therefore "beta". The ASR engine
// and model names are configured server-side via env, not hard-coded here.

export type LanguageStatus = 'beta' | 'stable' | 'unsupported';

export interface LanguageSupport {
  code: string;          // ISO tag sent to the ASR / translation layer
  label: string;         // display name
  status: LanguageStatus;
  fallback: string;      // code to try when this language fails, or 'auto'
  note?: string;
}

export const AUTO_DETECT = 'auto';

// The provider can attempt many more languages; we only surface the ones we
// intend to support and validate. Add rows here as coverage is confirmed.
export const SUPPORTED_LANGUAGES: LanguageSupport[] = [
  { code: 'en', label: 'English', status: 'beta', fallback: 'auto', note: 'Most reliable; pending real-audio validation before promotion to stable.' },
  { code: 'sw', label: 'Swahili', status: 'beta', fallback: 'en' },
  { code: 'lg', label: 'Luganda', status: 'beta', fallback: 'en' },
  { code: 'fr', label: 'French', status: 'beta', fallback: 'en' },
  { code: 'es', label: 'Spanish', status: 'beta', fallback: 'en' },
];

export function getLanguage(code: string): LanguageSupport | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function isSupported(code: string): boolean {
  return code === AUTO_DETECT || !!getLanguage(code);
}

export function needsBetaBadge(lang: LanguageSupport): boolean {
  return lang.status === 'beta';
}
