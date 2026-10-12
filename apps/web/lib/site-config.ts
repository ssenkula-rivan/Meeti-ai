// Single source of truth for legal and contact values that still need to be
// confirmed before publishing. Fill each field with its real value; while a
// field is unset it keeps the [SET: ...] marker, which the placeholder CI check
// looks for in the built output and fails the deploy on.

const set = (label: string) => `[SET: ${label}]`;

export const SITE = {
  legal: {
    // Known facts from existing copy — not placeholders.
    entityName: 'Cranictech',
    address: `Nasser Road, Printer's Miracle Centre, Uganda`,

    // Must be filled in.
    registrationNumber: set('company registration number'),
    supportEmail: set('support email'),
    privacyEmail: set('privacy email'),
    securityEmail: set('security email'),
    ageLimit: set('minimum age'),
    governingLaw: set('governing law and venue'),
    liabilityCap: set('liability cap'),
    refundPolicy: set('refund policy'),
    analyticsTools: set('analytics tools used'),
    paymentProcessor: set('payment processor'),
    responseTime: set('support response time'),

    // Requires a legal or engineering decision, not just a value.
    dataTransferSafeguards: set('cross-border transfer safeguards (lawyer)'),
    dataControllerRegistration: set('PDPO controller registration status (lawyer)'),
    dataAtRestEncryption: set('data-at-rest encryption status (engineering)'),
    changeNoticeMethod: set('how policy changes are notified'),
  },
} as const;

export type LegalField = keyof typeof SITE.legal;

export function isPlaceholder(value: string): boolean {
  return value.startsWith('[SET:');
}
