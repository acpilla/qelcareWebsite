-- ============================================================
-- QELCare Patient Mobile Patch — regenerated against qelcaresql-V7.sql
-- qelcaresql-V7 was a full schema+data dump. This patch intentionally
-- does NOT import, overwrite, or ship that data. It only adds/repairs
-- structures needed by the patient-only Capacitor APK.
--
-- Safe to run more than once.
-- ============================================================

-- 1) Ensure the Patient role exists. Do not assume role_id = 5.
INSERT INTO roles (role_name) VALUES ('Patient')
ON CONFLICT (role_name) DO NOTHING;

-- 2) OTP compatibility.
-- qelcaresql-V7 contains both of these check constraints on otp_requests:
--   chk_otp_purpose:              password_reset, registration
--   otp_requests_purpose_check:   password_reset, email_verification
-- Because both constraints must pass, only password_reset is reliably usable.
-- Replace them with one mobile-safe constraint.
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) DEFAULT 'password_reset';
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS code VARCHAR(10);

UPDATE otp_requests
SET purpose = 'password_reset'
WHERE purpose IS NULL
   OR purpose NOT IN ('password_reset','registration','email_verification','profile_update');

DO $$
BEGIN
  ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS chk_otp_purpose;
  ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS otp_requests_purpose_check;
  ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS otp_requests_purpose_mobile_check;

  ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_purpose_mobile_check
    CHECK (purpose IN ('password_reset','registration','email_verification','profile_update'));
END $$;

CREATE INDEX IF NOT EXISTS idx_otp_requests_email_lower ON otp_requests (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_otp_requests_purpose ON otp_requests (purpose);

-- 3) Patient table compatibility with the current backend models.
-- qelcaresql-V7 already has these columns. The ADD COLUMN statements keep
-- the patch safe for older copies of the database.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS contact VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name VARCHAR(80);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name VARCHAR(80);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name VARCHAR(80);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS suffix VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE patients
SET contact = phone
WHERE contact IS NULL AND phone IS NOT NULL;

UPDATE patients
SET phone = contact
WHERE phone IS NULL AND contact IS NOT NULL;

UPDATE patients
SET name = COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), 'Patient')
WHERE name IS NULL OR TRIM(name) = '';

-- 4) user_addresses compatibility for profile updates.
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_addresses'::regclass
      AND contype = 'u'
      AND conname = 'user_addresses_user_id_key'
  ) THEN
    ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'user_addresses_user_id_key could not be added automatically: %', SQLERRM;
END $$;

-- 5) Patient-uploaded lab/medical result table.
-- qelcaresql-V7 already has this table and data. This CREATE TABLE is for
-- older databases that do not have it yet.
CREATE TABLE IF NOT EXISTS patient_medical_results (
  result_id       SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uploaded_by     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  result_type     VARCHAR(100),
  source_facility VARCHAR(200),
  result_date     DATE,
  extracted_text  TEXT,
  summary_notes   TEXT,
  file_url        TEXT,
  file_public_id  TEXT,
  file_mime       VARCHAR(120),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patient_results_patient_id ON patient_medical_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_results_uploaded_by ON patient_medical_results(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_patient_results_result_date ON patient_medical_results(result_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_results_not_deleted ON patient_medical_results(patient_id, deleted_at);

-- 6) Updated-at trigger for patient_medical_results when trigger function exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trigger_set_updated_at'
      AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trg_patient_medical_results_updated_at ON patient_medical_results;
    CREATE TRIGGER trg_patient_medical_results_updated_at
    BEFORE UPDATE ON patient_medical_results
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- 7) Helpful cleanup only for OTP rows, not user/patient/clinical data.
DELETE FROM otp_requests
WHERE expires_at < NOW() - INTERVAL '1 day';
