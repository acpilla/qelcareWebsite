-- ============================================================================
-- QELCare — Post-review hardening migration               (2026-07-25)
-- ----------------------------------------------------------------------------
-- Idempotent. Safe to re-run. Runs in ONE transaction (all-or-nothing).
-- Back up first:  pg_dump -Fc your_db > before_review_fixes.dump
--
-- Fixes:
--   1. Add FOR_BILLING to the appointment status CHECK (unbreaks billing)
--   2. Fix trigger_billing_voided() so a voided bill can be re-billed
--   3. FK ON DELETE fixes (patient/appointment deletion no longer dead-ends)
--   4. Partial unique index to stop double-billing + supporting indexes
--   5. DB-enforced token revocation on deactivate / lock / role change
--   6. Case-insensitive UNIQUE email & username (guarded against dirty data)
--   7. Drop duplicate indexes
--   8. Drop duplicate CHECK constraints & redundant updated_at triggers
--
-- Watch the Messages tab for any "SKIPPING ..." notices (dirty-data cases).
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Appointment status: add FOR_BILLING, collapse the duplicate CHECK
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS chk_appt_status;
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT chk_appt_status
    CHECK (status IN ('PENDING','CONFIRMED','IN_QUEUE','FOR_BILLING',
                      'COMPLETED','CANCELLED','RESCHEDULED','NO_SHOW'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Voided bill must return the visit to FOR_BILLING (was a no-op COMPLETED)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_billing_voided() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'VOIDED' AND OLD.status = 'PAID' THEN
    UPDATE public.appointments
       SET status = 'FOR_BILLING', updated_at = NOW()
     WHERE id = NEW.appointment_id
       AND status = 'COMPLETED';
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Foreign-key ON DELETE fixes
--    queue_entries: CASCADE  (ephemeral daily rows — go with the appointment)
--    billing:       SET NULL (keep the financial/audit row, drop the link)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.queue_entries DROP CONSTRAINT IF EXISTS queue_entries_appointment_id_fkey;
ALTER TABLE public.queue_entries
  ADD CONSTRAINT queue_entries_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE public.billing DROP CONSTRAINT IF EXISTS billing_appointment_id_fkey;
ALTER TABLE public.billing
  ADD CONSTRAINT billing_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Stop double-billing + add the missing FK-supporting indexes
--    The partial unique index is created only if no appointment already has
--    two PAID bills (resolve those first, then create it manually).
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_billing_appointment_id ON public.billing (appointment_id);
CREATE INDEX IF NOT EXISTS idx_billing_cashier_id     ON public.billing (cashier_id);

DO $$
DECLARE dup int;
BEGIN
  SELECT COUNT(*) INTO dup FROM (
    SELECT appointment_id
      FROM public.billing
     WHERE status = 'PAID' AND appointment_id IS NOT NULL
     GROUP BY appointment_id HAVING COUNT(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE NOTICE 'SKIPPING uq_billing_appt_paid: % appointment(s) already have >1 PAID bill. Void the duplicates, then create the index manually.', dup;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_appt_paid ON public.billing (appointment_id) WHERE status = ''PAID''';
    RAISE NOTICE 'OK: uq_billing_appt_paid in place.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. DB-enforced session kill on deactivate / lock / role change
--    Belt-and-suspenders: holds even if the app forgets to revoke tokens.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_revoke_tokens_on_user_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.status IN ('deactivated','locked') AND NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.role_id IS DISTINCT FROM OLD.role_id) THEN
    DELETE FROM public.active_tokens WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_tokens_on_user_change ON public.users;
CREATE TRIGGER trg_revoke_tokens_on_user_change
  AFTER UPDATE OF status, role_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trigger_revoke_tokens_on_user_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Case-insensitive UNIQUE email & username (guarded against dirty data).
--    Keeps the existing case-sensitive keys as-is; adds lower() uniqueness.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE dup int;
BEGIN
  SELECT COUNT(*) INTO dup FROM (
    SELECT lower(email) FROM public.users GROUP BY lower(email) HAVING COUNT(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE NOTICE 'SKIPPING uq_users_email_lower: % case-insensitive duplicate email(s). Resolve, then create manually.', dup;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON public.users (lower(email))';
    EXECUTE 'DROP INDEX IF EXISTS public.idx_users_email';  -- superseded by the unique one
    RAISE NOTICE 'OK: uq_users_email_lower in place.';
  END IF;
END $$;

DO $$
DECLARE dup int;
BEGIN
  SELECT COUNT(*) INTO dup FROM (
    SELECT lower(username) FROM public.users GROUP BY lower(username) HAVING COUNT(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE NOTICE 'SKIPPING uq_users_username_lower: % case-insensitive duplicate username(s). Resolve, then create manually.', dup;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON public.users (lower(username))';
    EXECUTE 'DROP INDEX IF EXISTS public.idx_users_username';
    RAISE NOTICE 'OK: uq_users_username_lower in place.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Drop duplicate indexes (each pair indexes the same column twice)
-- ─────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_records_patient;     -- keep idx_records_patient_id
DROP INDEX IF EXISTS public.idx_users_specialty;     -- keep idx_users_specialty_id
DROP INDEX IF EXISTS public.idx_tokens_expires_at;   -- keep idx_active_tokens_expires
DROP INDEX IF EXISTS public.idx_tokens_user_id;      -- keep idx_active_tokens_user

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Drop duplicate CHECK constraints & redundant updated_at triggers
--    (keeps one set_updated_at per table + the meaningful triggers)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_type_check;  -- keep chk_appt_type
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT chk_appt_type
    CHECK (type IN ('consultation','follow_up','walk_in','emergency'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;              -- keep chk_user_status
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT chk_user_status
    CHECK (status IN ('unverified','verified','deactivated','locked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.appointments;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.billing;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.medical_records;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.patients;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.queue_entries;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.user_addresses;
DROP TRIGGER IF EXISTS trg_set_updated_at   ON public.users;
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;

COMMIT;

-- ============================================================================
-- VERIFY (run separately after COMMIT — read-only)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.appointments'::regclass AND conname = 'chk_appt_status';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'billing' ORDER BY 1;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal;
-- SELECT conname, confdeltype FROM pg_constraint
--   WHERE conname IN ('queue_entries_appointment_id_fkey','billing_appointment_id_fkey');
--   -- confdeltype: 'c' = CASCADE, 'n' = SET NULL
