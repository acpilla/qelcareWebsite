-- ============================================================================
-- Patient data-privacy consent tracking
-- ----------------------------------------------------------------------------
-- Records that a patient agreed to the Data Privacy Statement + Terms of
-- Service at registration (Data Privacy Act of 2012 / RA 10173 auditability).
--
-- Safe to run multiple times (idempotent). Apply to your QELCare database:
--   psql "$DATABASE_URL" -f qelcare-backend/database/privacy_consent_patch.sql
-- Then restart the backend.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version   VARCHAR(20);
