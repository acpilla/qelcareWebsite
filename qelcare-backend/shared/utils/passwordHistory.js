// ============================================================================
// Password-reuse prevention
// ----------------------------------------------------------------------------
// Blocks a user from setting a new password that matches their CURRENT password
// or any of their last KEEP retired passwords. Fixes the gap where, after
// changing OLD -> NEW, the OLD password could immediately be set again (the old
// checks only compared against the *current* password).
//
// Degrades gracefully: the current-password check always runs; the history
// lookup is wrapped so an infra/table issue can never break a password reset.
// The password_history table is created on demand (idempotent) so no manual
// migration step is required — see database/password_history_patch.sql.
// ============================================================================
const pool = require("../../config/database");
const bcrypt = require("bcrypt");

const KEEP = 5; // how many previous passwords to remember per user

let ensuredPromise = null;
async function ensureTable() {
  if (!ensuredPromise) {
    ensuredPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_history (
          id            SERIAL PRIMARY KEY,
          user_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          password_hash TEXT NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_password_history_user
           ON password_history (user_id, created_at DESC)`
      );
    })().catch((err) => {
      ensuredPromise = null; // allow a later retry
      throw err;
    });
  }
  return ensuredPromise;
}

// True if newPassword equals the current hash OR a recent retired hash.
async function isPasswordReused(client, userId, newPassword, currentHash) {
  // Always block the current password (works even if history is unavailable).
  if (currentHash && (await bcrypt.compare(newPassword, currentHash))) return true;

  try {
    await ensureTable();
    const { rows } = await client.query(
      `SELECT password_hash FROM password_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, KEEP]
    );
    for (const row of rows) {
      if (await bcrypt.compare(newPassword, row.password_hash)) return true;
    }
  } catch (err) {
    // Never let reuse-prevention break the critical password-reset flow.
    console.error("[passwordHistory] reuse check skipped:", err.message);
  }
  return false;
}

// Record a retired password hash and keep only the last KEEP per user.
async function recordRetiredPassword(client, userId, retiredHash) {
  if (!retiredHash) return;
  try {
    await ensureTable();
    await client.query(
      `INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)`,
      [userId, retiredHash]
    );
    await client.query(
      `DELETE FROM password_history
        WHERE user_id = $1
          AND id NOT IN (
            SELECT id FROM password_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2
          )`,
      [userId, KEEP]
    );
  } catch (err) {
    // Recording history is best-effort; the password change itself still stands.
    console.error("[passwordHistory] could not record retired password:", err.message);
  }
}

const REUSE_MESSAGE =
  "You can't reuse your current password or a recent previous one. Please choose a new password.";

module.exports = { isPasswordReused, recordRetiredPassword, REUSE_MESSAGE, KEEP };
