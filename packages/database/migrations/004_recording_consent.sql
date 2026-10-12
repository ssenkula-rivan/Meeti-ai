-- 004_recording_consent.sql
-- Per-meeting recording consent. Add-only and backward compatible:
-- existing rows default to consent_confirmed = false, and the feature is
-- enforced only when FEATURE_RECORDING_CONSENT is on, so live behaviour is
-- unchanged until it is enabled.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_confirmed_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_version VARCHAR(50);

-- Rollback:
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_version;
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_confirmed_at;
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_confirmed;
-- 004_recording_consent.sql
-- Per-meeting recording consent. Add-only and backward compatible:
-- existing rows default to consent_confirmed = false, and enforcement is
-- active only when FEATURE_RECORDING_CONSENT is on, so live behaviour is
-- unchanged until it is enabled.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_confirmed_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS consent_version VARCHAR(50);

-- Rollback:
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_version;
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_confirmed_at;
--   ALTER TABLE meetings DROP COLUMN IF EXISTS consent_confirmed;
