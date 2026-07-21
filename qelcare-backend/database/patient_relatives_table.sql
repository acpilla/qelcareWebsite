-- ============================================================================
-- Saved relatives ("book for someone else" address book)
-- ----------------------------------------------------------------------------
-- A patient can save the people they book for (relationship, basic details) so
-- they don't have to retype them every time. Owned by the patient's user account.
--
-- Idempotent. Apply with:
--   psql "$DATABASE_URL" -f qelcare-backend/database/patient_relatives_table.sql
-- Then restart the backend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_relatives (
  relative_id    SERIAL       PRIMARY KEY,
  owner_user_id  INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  first_name     VARCHAR(80)  NOT NULL,
  last_name      VARCHAR(80)  NOT NULL,
  relationship   VARCHAR(80)  NOT NULL,
  date_of_birth  DATE,
  age            INTEGER,
  gender         VARCHAR(20),
  phone          VARCHAR(30),
  email          VARCHAR(150),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_relatives_owner ON patient_relatives(owner_user_id);
