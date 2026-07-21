-- ============================================================================
-- Medication doctor-approval workflow
-- ----------------------------------------------------------------------------
-- A patient-added medication must be reviewed by a doctor before it becomes an
-- active reminder. Existing rows are marked 'approved' so current data keeps
-- working; new patient submissions default to 'pending'.
--
-- Idempotent. Apply with:
--   psql "$DATABASE_URL" -f qelcare-backend/database/medication_approval_patch.sql
-- Then restart the backend.
-- ============================================================================

ALTER TABLE patient_medications ADD COLUMN IF NOT EXISTS approval_status  VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE patient_medications ADD COLUMN IF NOT EXISTS approved_by      INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE patient_medications ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE patient_medications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$ BEGIN
  ALTER TABLE patient_medications
    ADD CONSTRAINT chk_med_approval CHECK (approval_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_patient_medications_approval ON patient_medications(approval_status);
