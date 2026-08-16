-- ============================================================
-- Password-reuse prevention
-- ------------------------------------------------------------
-- Stores recently retired password hashes per user so a reset or
-- change can reject reverting to the current or a recent previous
-- password. The backend also creates this table on demand
-- (shared/utils/passwordHistory.js), so running this by hand is
-- optional. Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_history (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user
  ON password_history (user_id, created_at DESC);
