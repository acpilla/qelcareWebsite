-- ============================================================================
-- Public inquiries (book / ask without an account)
-- ----------------------------------------------------------------------------
-- A visitor who does not want to create an account can submit an inquiry from
-- the login page. It lands in the Admin / Front desk inbox to be followed up.
--
-- Idempotent. Apply with:
--   psql "$DATABASE_URL" -f qelcare-backend/database/inquiries_table.sql
-- Then restart the backend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inquiries (
  inquiry_id     SERIAL       PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(150),
  phone          VARCHAR(30),
  subject        VARCHAR(150),
  message        TEXT         NOT NULL,
  preferred_date DATE,
  status         VARCHAR(20)  NOT NULL DEFAULT 'new',
  handled_by     INT          REFERENCES users(user_id) ON DELETE SET NULL,
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inquiry_status CHECK (status IN ('new','in_progress','resolved','archived'))
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status     ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
