-- ============================================================
-- QELCARE DATABASE FUNCTIONS
-- Run AFTER schema.sql
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  OR NUMBER GENERATOR                                        ║
-- ║  Format: QEL-YYYY-NNNNN                                    ║
-- ║  Example: QEL-2025-00001                                   ║
-- ║  Resets per year. Thread-safe via sequence per year.       ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Helper table to track per-year sequence counters
CREATE TABLE IF NOT EXISTS or_number_seq (
  year       INT  PRIMARY KEY,
  last_num   INT  NOT NULL DEFAULT 0
);

-- Main generator function
CREATE OR REPLACE FUNCTION generate_or_number()
RETURNS VARCHAR(30)
LANGUAGE plpgsql
AS $$
DECLARE
  v_year    INT;
  v_seq     INT;
  v_or      VARCHAR(30);
BEGIN
  v_year := EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila')::INT;

  -- Upsert into sequence table, atomically increment
  INSERT INTO or_number_seq (year, last_num)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_num = or_number_seq.last_num + 1
  RETURNING last_num INTO v_seq;

  -- Format: QEL-2025-00001
  v_or := 'QEL-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 5, '0');

  RETURN v_or;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  QUEUE NUMBER GENERATOR                                     ║
-- ║  Per-specialty, per-day sequential queue numbers.          ║
-- ║  Resets to 1 each new day per specialty.                   ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION generate_queue_number(p_specialty_id INT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INT;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO   v_next
  FROM   queue_entries
  WHERE  specialty_id = p_specialty_id
    AND  queue_date   = p_date;

  RETURN v_next;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  AUTO-UPDATE updated_at TRIGGER                            ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_addresses','patients','appointments',
    'medical_records','queue_entries','billing'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
      CREATE TRIGGER trg_set_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BMI AUTO-CALCULATE TRIGGER (on vitals)                    ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trigger_compute_bmi()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_height_m DECIMAL(8,4);
BEGIN
  IF NEW.weight_kg IS NOT NULL AND NEW.height_cm IS NOT NULL AND NEW.height_cm > 0 THEN
    v_height_m := NEW.height_cm / 100.0;
    NEW.bmi := ROUND((NEW.weight_kg / (v_height_m * v_height_m))::NUMERIC, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_bmi ON vitals;
CREATE TRIGGER trg_compute_bmi
BEFORE INSERT OR UPDATE OF weight_kg, height_cm ON vitals
FOR EACH ROW EXECUTE FUNCTION trigger_compute_bmi();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SYNC PATIENT LEGACY NAME COLUMN TRIGGER                   ║
-- ║  Keeps patients.name in sync with first_name + last_name   ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trigger_sync_patient_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_name ON patients;
CREATE TRIGGER trg_sync_patient_name
BEFORE INSERT OR UPDATE OF first_name, last_name ON patients
FOR EACH ROW EXECUTE FUNCTION trigger_sync_patient_name();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  VOID BILLING — restore appointment status trigger         ║
-- ║  When billing is voided, appointment goes back to CONFIRMED ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trigger_billing_voided()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'VOIDED' AND OLD.status = 'PAID' THEN
    UPDATE appointments
    SET    status     = 'CONFIRMED',
           updated_at = NOW()
    WHERE  id = NEW.appointment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_voided ON billing;
CREATE TRIGGER trg_billing_voided
AFTER UPDATE OF status ON billing
FOR EACH ROW EXECUTE FUNCTION trigger_billing_voided();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  PATIENT AUTO-CREATE TRIGGER                               ║
-- ║  When a Patient-role user's status becomes 'verified',     ║
-- ║  automatically creates their patient record if not exists. ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trigger_auto_create_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  -- Only proceed when status just became 'verified'
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    -- Check if this user has the Patient role
    SELECT r.role_name INTO v_role_name
    FROM   roles r
    WHERE  r.role_id = NEW.role_id;

    IF v_role_name = 'Patient' THEN
      -- Create patient record if not already linked
      IF NOT EXISTS (SELECT 1 FROM patients WHERE user_id = NEW.user_id) THEN
        INSERT INTO patients (
          user_id, first_name, last_name, email,
          phone, name, is_active, created_at
        )
        VALUES (
          NEW.user_id,
          COALESCE(NEW.first_name, ''),
          COALESCE(NEW.last_name, ''),
          NEW.email,
          NEW.phone,
          TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'')),
          TRUE,
          NOW()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_patient ON users;
CREATE TRIGGER trg_auto_create_patient
AFTER UPDATE OF status ON users
FOR EACH ROW EXECUTE FUNCTION trigger_auto_create_patient();
