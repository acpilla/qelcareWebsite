-- ============================================================
-- QELCARE MIGRATION — Phase 1
-- Safe incremental migration for EXISTING database.
-- Each block is idempotent (safe to run multiple times).
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add missing columns to existing tables            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- users: ensure all columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name       VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suffix            VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender            VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth     DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alternate_phone   VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Add status constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND constraint_name = 'chk_user_status'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_user_status
      CHECK (status IN ('unverified','verified','deactivated','locked'));
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- user_addresses: add UNIQUE constraint for ON CONFLICT to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_addresses'::regclass AND contype = 'u'
    AND conname = 'user_addresses_user_id_key'
  ) THEN
    ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- specialties: add missing columns
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS slug           VARCHAR(100);
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS display_order  INT DEFAULT 0;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE;

-- Add unique on slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'specialties'::regclass AND contype = 'u'
    AND conname = 'specialties_slug_key'
  ) THEN
    -- Backfill slugs before adding constraint
    UPDATE specialties SET slug = LOWER(REPLACE(REPLACE(specialty_name,' ','-'),'/',''))
    WHERE slug IS NULL OR slug = '';
    ALTER TABLE specialties ADD CONSTRAINT specialties_slug_key UNIQUE (slug);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- patients: ensure all columns exist
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name                  VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name                   VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name                 VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS suffix                      VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_type                  VARCHAR(10);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name      VARCHAR(200);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone     VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_relation  VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS philhealth_no               VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS senior_pwd_id               VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at                  TIMESTAMPTZ DEFAULT NOW();

-- appointments: add check constraints if missing
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appt_type
    CHECK (type IN ('consultation','follow_up','walk_in','emergency'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appt_status
    CHECK (status IN ('PENDING','CONFIRMED','IN_QUEUE','COMPLETED','CANCELLED','RESCHEDULED','NO_SHOW'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vitals: ensure all columns exist
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS o2_saturation          DECIMAL(5,2);
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS lmp                    DATE;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS chief_complaint        TEXT;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS nurse_notes            TEXT;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS routed_to_specialty_id INT REFERENCES specialties(specialty_id);
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS recorded_at            TIMESTAMPTZ DEFAULT NOW();

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: medical_records — remove vitals columns           ║
-- ║  (vitals are now exclusively in the vitals table)          ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Add the correct columns to medical_records
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS vital_id           INT REFERENCES vitals(vital_id) ON DELETE SET NULL;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS visit_date         DATE;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS chief_complaint    TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS history_of_illness TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS physical_exam      TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS diagnosis          TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS treatment_plan     TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS prescriptions      TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS lab_requests       TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS doctor_notes       TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS follow_up_date     DATE;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS follow_up_notes    TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_confidential    BOOLEAN DEFAULT FALSE;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- Rename 'id' PK to 'record_id' (only if column exists as 'id')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medical_records' AND column_name = 'id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medical_records' AND column_name = 'record_id'
  ) THEN
    ALTER TABLE medical_records RENAME COLUMN id TO record_id;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop old vitals columns from medical_records (if they exist)
-- These are being migrated into the vitals table
ALTER TABLE medical_records DROP COLUMN IF EXISTS blood_pressure;
ALTER TABLE medical_records DROP COLUMN IF EXISTS heart_rate;
ALTER TABLE medical_records DROP COLUMN IF EXISTS temperature;
ALTER TABLE medical_records DROP COLUMN IF EXISTS respiratory_rate;
ALTER TABLE medical_records DROP COLUMN IF EXISTS oxygen_saturation;
ALTER TABLE medical_records DROP COLUMN IF EXISTS weight_kg;
ALTER TABLE medical_records DROP COLUMN IF EXISTS height_cm;
ALTER TABLE medical_records DROP COLUMN IF EXISTS bmi;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: billing table updates                             ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE billing ADD COLUMN IF NOT EXISTS subtotal      DECIMAL(10,2) DEFAULT 0;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS voided_at     TIMESTAMPTZ;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS voided_by     INT REFERENCES users(user_id);
ALTER TABLE billing ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE billing ADD CONSTRAINT chk_billing_status
    CHECK (status IN ('PAID','VOIDED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE billing ADD CONSTRAINT chk_billing_discount_type
    CHECK (discount_type IN ('none','senior','pwd','philhealth','hmo','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE billing ADD CONSTRAINT chk_billing_payment_method
    CHECK (payment_method IN ('cash','gcash','maya','card','philhealth','hmo'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 4: queue_entries updates                             ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS priority    INT DEFAULT 0;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS called_at   TIMESTAMPTZ;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE queue_entries ADD CONSTRAINT chk_queue_status
    CHECK (status IN ('WAITING','CALLED','IN_PROGRESS','DONE','SKIPPED','NO_SHOW'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rename queue_id PK if exists as 'id'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queue_entries' AND column_name = 'id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queue_entries' AND column_name = 'queue_id'
  ) THEN
    ALTER TABLE queue_entries RENAME COLUMN id TO queue_id;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 5: otp_requests — add purpose column                 ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) DEFAULT 'password_reset';

DO $$
BEGIN
  ALTER TABLE otp_requests ADD CONSTRAINT chk_otp_purpose
    CHECK (purpose IN ('password_reset','registration'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 6: Add Receptionist role if missing                  ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO roles (role_name) VALUES ('Receptionist')
ON CONFLICT (role_name) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 7: Update specialty slugs (fill empty)               ║
-- ╚══════════════════════════════════════════════════════════════╝

UPDATE specialties SET slug = 'cardiology'       WHERE specialty_name = 'Cardiology'              AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'gastroenterology' WHERE specialty_name = 'Gastroenterology'         AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'ob-gyne'          WHERE specialty_name = 'Ob-Gyne'                 AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'pediatrics'       WHERE specialty_name = 'Pediatrics'              AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'psychiatry'       WHERE specialty_name = 'Psychiatry'              AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'rehab'            WHERE specialty_name = 'Rehabilitation Medicine' AND (slug IS NULL OR slug = '');
UPDATE specialties SET slug = 'ent'              WHERE specialty_name = 'ENT'                     AND (slug IS NULL OR slug = '');

-- Insert any missing specialties
INSERT INTO specialties (specialty_name, slug, description, display_order) VALUES
  ('Cardiology',             'cardiology',        'Heart and cardiovascular system',              1),
  ('Gastroenterology',       'gastroenterology',  'Digestive system and gastrointestinal tract',  2),
  ('Ob-Gyne',                'ob-gyne',           'Obstetrics and Gynecology',                    3),
  ('Pediatrics',             'pediatrics',        'Medical care for infants, children, and teens',4),
  ('Psychiatry',             'psychiatry',        'Mental health and behavioral medicine',         5),
  ('Rehabilitation Medicine','rehab',             'Physical medicine and rehabilitation therapy',  6),
  ('ENT',                    'ent',               'Ear, Nose, and Throat (Otolaryngology)',        7)
ON CONFLICT (specialty_name) DO UPDATE SET
  slug          = EXCLUDED.slug,
  display_order = EXCLUDED.display_order;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 8: Create OR number sequence table if missing        ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS or_number_seq (
  year     INT PRIMARY KEY,
  last_num INT NOT NULL DEFAULT 0
);

INSERT INTO or_number_seq (year, last_num)
VALUES (EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila')::INT, 0)
ON CONFLICT (year) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 9: Create all missing indexes                        ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_users_role_id        ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_tokens_user_id       ON active_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at    ON active_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_patients_user_id     ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_is_active   ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_appts_patient_id     ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appts_doctor_id      ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appts_date_status    ON appointments(date, status);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id    ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_appt_id       ON vitals(appointment_id);
CREATE INDEX IF NOT EXISTS idx_records_patient_id   ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_specialty_date ON queue_entries(specialty_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_status         ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_billing_patient_id   ON billing(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_or_number    ON billing(or_number);
CREATE INDEX IF NOT EXISTS idx_billing_paid_at      ON billing(paid_at);
CREATE INDEX IF NOT EXISTS idx_logs_user_id         ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at      ON activity_logs(created_at DESC);
