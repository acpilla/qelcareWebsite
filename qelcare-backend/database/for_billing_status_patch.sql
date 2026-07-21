-- ============================================================================
-- "For Billing" payment gate
-- ----------------------------------------------------------------------------
-- After the doctor completes a consultation, the visit becomes FOR_BILLING
-- (awaiting cashier payment) instead of COMPLETED. The cashier records payment,
-- which moves it to COMPLETED. This adds the FOR_BILLING value to the
-- appointments status CHECK constraint.
--
-- Idempotent. Apply with:
--   psql "$DATABASE_URL" -f qelcare-backend/database/for_billing_status_patch.sql
-- Then restart the backend.
-- ============================================================================

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appt_status;

ALTER TABLE appointments
  ADD CONSTRAINT chk_appt_status
  CHECK (status IN ('PENDING','CONFIRMED','IN_QUEUE','FOR_BILLING','COMPLETED','CANCELLED','RESCHEDULED','NO_SHOW'));
