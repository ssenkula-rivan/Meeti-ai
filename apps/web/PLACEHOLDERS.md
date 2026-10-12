# Placeholders to fill before publishing

Every legal/contact value lives in **one** file:

```
apps/web/lib/site-config.ts   ->  SITE.legal
```

Fill each field below with its real value (replace the `set('...')` call with a
plain string). The pages under `app/about`, `app/privacy`, `app/terms`,
`app/security` and `app/ai-policy`, plus `/.well-known/security.txt`, all read
from this file — do not hard-code these values in the pages.

The CI job (`.github/workflows/ci.yml`) runs `apps/web/scripts/check-placeholders.mjs`,
which **fails the build if any `[SET: ...]` marker is still rendered** in the built
HTML. The build goes green only once every field below is filled.

## Contact & identity
- [ ] `registrationNumber` — company registration number (currently shown as `[SET: company registration number]`)
- [ ] `supportEmail` — general support contact
- [ ] `privacyEmail` — data-protection contact
- [ ] `securityEmail` — security issue reports (also feeds `/.well-known/security.txt`)

## Policy values
- [ ] `ageLimit` — minimum user age (privacy §9, terms §2)
- [ ] `governingLaw` — governing law / venue / arbitration decision (terms §14) — **needs a lawyer**
- [ ] `liabilityCap` — limitation-of-liability amount (terms §13) — **needs a lawyer**
- [ ] `refundPolicy` — refund terms (used once paid billing exists)
- [ ] `responseTime` — support response commitment (ai-policy §9)

## Disclosures
- [ ] `analyticsTools` — confirm "no third-party analytics" claim, or list tools (privacy §2)
- [ ] `paymentProcessor` — payment provider name (used once paid billing exists)

## Requires a legal or engineering decision (not just a value)
- [ ] `dataTransferSafeguards` — cross-border transfer safeguards (privacy §5) — **lawyer**
- [ ] `dataControllerRegistration` — whether Cranictech must register with the Uganda PDPO (privacy §10) — **lawyer**
- [ ] `dataAtRestEncryption` — status of at-rest encryption (privacy §8) — **engineering**
- [ ] `changeNoticeMethod` — how policy/terms changes are notified (terms §15)

## Already set (verify, do not invent)
- `entityName` = `Cranictech`
- `address` = `Nasser Road, Printer's Miracle Centre, Uganda`

> These two come from existing copy. If they are wrong, correct them — but the
> registration number and every email above must be supplied by you; nothing here
> has been invented.
