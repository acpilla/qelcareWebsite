-- ============================================================
-- Index for the patient booking/cancel cooldown lookup
-- ------------------------------------------------------------
-- The cooldown check runs on every patient booking/cancellation
-- (features/appointment/models/Appointment.js -> assertAppointmentCooldown):
--
--   SELECT MAX(updated_at) FROM appointments
--    WHERE cancelled_by = $1 AND status = 'CANCELLED';
--
-- This partial, composite index turns that from a sequential scan into an index
-- scan and answers the MAX(updated_at) straight from the index ordering. Safe to
-- run more than once. On a live DB prefer:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ...   (no write lock; run outside a txn)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appts_cancelled_by
  ON appointments (cancelled_by, updated_at DESC)
  WHERE status = 'CANCELLED';
