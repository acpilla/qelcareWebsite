-- ============================================================
-- Open pending slots: only CONFIRMED appointments hold a slot
-- ------------------------------------------------------------
-- Rebuilds uq_doctor_datetime so uniqueness is enforced ONLY among
-- confirmed-and-beyond appointments. Multiple PENDING / RESCHEDULED
-- requests may then share the same doctor/date/time until the clinic
-- confirms one; confirming atomically claims the slot and auto-declines
-- the other pending requests (see Appointment.confirmAndDeclineConflicts
-- and ACTIVE_CONFLICT_STATUSES in features/appointment/models/Appointment.js).
--
-- Wrapped in a transaction so the index swap is atomic: if the new index
-- cannot be built (e.g. two confirmed rows already share a slot) the old
-- index is restored and nothing changes. Safe to run more than once.
-- ============================================================
BEGIN;

DROP INDEX IF EXISTS uq_doctor_datetime;

CREATE UNIQUE INDEX uq_doctor_datetime
  ON appointments (doctor_id, date, "time")
  WHERE status IN ('CONFIRMED', 'IN_QUEUE', 'FOR_BILLING', 'COMPLETED');

COMMIT;
