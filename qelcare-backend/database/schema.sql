-- ============================================================
-- QELCARE HEALTHCARE MANAGEMENT SYSTEM
-- Complete Database Schema
-- Version: 2.0 (Phase 1 — Stabilization)
-- Timezone: Asia/Manila
-- ============================================================
-- Run order: schema.sql → functions.sql → seed.sql
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 1: CORE AUTH TABLES                                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── ROLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  role_id    SERIAL      PRIMARY KEY,
  role_name  VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id                SERIAL       PRIMARY KEY,
  role_id                INT          NOT NULL REFERENCES roles(role_id),
  username               VARCHAR(80)  NOT NULL UNIQUE,
  email                  VARCHAR(255) NOT NULL UNIQUE,
  password               VARCHAR(255) NOT NULL,

  -- Name
  first_name             VARCHAR(100),
  last_name              VARCHAR(100),
  middle_name            VARCHAR(100),
  suffix                 VARCHAR(20),

  -- Personal
  gender                 VARCHAR(20),
  date_of_birth          DATE,
  phone                  VARCHAR(30),
  alternate_phone        VARCHAR(30),
  profile_picture        TEXT,

  -- Auth state
  status                 VARCHAR(20)  NOT NULL DEFAULT 'unverified',
  -- Allowed: unverified | verified | deactivated | locked
  failed_login_attempts  INT          NOT NULL DEFAULT 0,
  lockout_until          TIMESTAMPTZ,
  last_login             TIMESTAMPTZ,

  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_user_status CHECK (
    status IN ('unverified','verified','deactivated','locked')
  )
);

-- ── USER ADDRESSES ───────────────────────────────────────────
-- Philippine-standard addressing (PSGC codes)
CREATE TABLE IF NOT EXISTS user_addresses (
  address_id         SERIAL       PRIMARY KEY,
  user_id            INT          NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  -- PSGC codes for dropdown-based address selection
  region_code        VARCHAR(20),
  province_code      VARCHAR(20),
  municipality_code  VARCHAR(20),
  barangay_code      VARCHAR(20),
  address_line       TEXT,           -- House no., street, landmark
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── ACTIVE TOKENS (JWT token store for revocation) ───────────
CREATE TABLE IF NOT EXISTS active_tokens (
  token_id    SERIAL       PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token       TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── OTP REQUESTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_requests (
  otp_id          SERIAL       PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  otp_hash        TEXT         NOT NULL,
  expires_at      TIMESTAMPTZ  NOT NULL,
  request_count   INT          NOT NULL DEFAULT 1,
  last_request_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- 'password_reset' | 'registration'
  purpose         VARCHAR(30)  NOT NULL DEFAULT 'password_reset',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_otp_purpose CHECK (
    purpose IN ('password_reset','registration')
  )
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 2: CLINICAL REFERENCE TABLES                      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── SPECIALTIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specialties (
  specialty_id    SERIAL       PRIMARY KEY,
  specialty_name  VARCHAR(100) NOT NULL UNIQUE,
  slug            VARCHAR(100) NOT NULL UNIQUE,  -- URL-safe: cardiology, ob-gyne, ent
  description     TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  display_order   INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 3: PATIENT SYSTEM                                 ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── PATIENTS ─────────────────────────────────────────────────
-- Represents actual patient medical records.
-- user_id is NULL for walk-ins; linked for Patient-role account holders.
CREATE TABLE IF NOT EXISTS patients (
  id                          SERIAL       PRIMARY KEY,
  user_id                     INT          UNIQUE REFERENCES users(user_id) ON DELETE SET NULL,
  -- Legacy combined name — kept for backward compat, synced on write
  name                        VARCHAR(255),

  -- Name (structured)
  first_name                  VARCHAR(100) NOT NULL,
  last_name                   VARCHAR(100) NOT NULL,
  middle_name                 VARCHAR(100),
  suffix                      VARCHAR(20),

  -- Demographics
  date_of_birth               DATE,
  gender                      VARCHAR(20),
  blood_type                  VARCHAR(10),

  -- Contact
  phone                       VARCHAR(30),
  email                       VARCHAR(255),
  address                     TEXT,

  -- Emergency contact
  emergency_contact_name      VARCHAR(200),
  emergency_contact_phone     VARCHAR(30),
  emergency_contact_relation  VARCHAR(100),

  -- Insurance / IDs
  philhealth_no               VARCHAR(50),
  senior_pwd_id               VARCHAR(50),

  -- Notes
  notes                       TEXT,

  -- State
  is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by                  INT          REFERENCES users(user_id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 4: APPOINTMENTS                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS appointments (
  id               SERIAL      PRIMARY KEY,
  patient_id       INT         NOT NULL REFERENCES patients(id)          ON DELETE CASCADE,
  doctor_id        INT         NOT NULL REFERENCES users(user_id),
  specialty_id     INT                  REFERENCES specialties(specialty_id),

  date             DATE        NOT NULL,
  time             TIME        NOT NULL,

  -- Appointment type
  type             VARCHAR(30) NOT NULL DEFAULT 'consultation',
  -- Allowed: consultation | follow_up | walk_in | emergency

  -- Status lifecycle
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING → CONFIRMED → IN_QUEUE → COMPLETED
  --         → CANCELLED | RESCHEDULED | NO_SHOW

  chief_complaint  TEXT,
  notes            TEXT,

  -- Audit
  booked_by        INT         REFERENCES users(user_id),
  cancelled_by     INT         REFERENCES users(user_id),
  cancel_reason    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_appt_type CHECK (
    type IN ('consultation','follow_up','walk_in','emergency')
  ),
  CONSTRAINT chk_appt_status CHECK (
    status IN ('PENDING','CONFIRMED','IN_QUEUE','COMPLETED','CANCELLED','RESCHEDULED','NO_SHOW')
  )
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 5: VITALS (Nurse-recorded, BEFORE doctor sees)    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Vitals are independently recorded by nurses.
-- They are linked to both patient and appointment.
-- Doctors read these; they do NOT record them.
CREATE TABLE IF NOT EXISTS vitals (
  vital_id           SERIAL       PRIMARY KEY,
  patient_id         INT          NOT NULL REFERENCES patients(id)       ON DELETE CASCADE,
  appointment_id     INT                   REFERENCES appointments(id)   ON DELETE SET NULL,
  recorded_by        INT                   REFERENCES users(user_id),     -- Nurse user_id

  -- Standard vitals
  temperature        DECIMAL(5,2),           -- °C
  blood_pressure     VARCHAR(20),            -- e.g. "120/80"
  pulse_rate         INT,                    -- bpm
  respiratory_rate   INT,                    -- breaths/min
  o2_saturation      DECIMAL(5,2),           -- %
  weight_kg          DECIMAL(6,2),
  height_cm          DECIMAL(6,2),
  bmi                DECIMAL(5,2),           -- auto-computed

  -- Specialty-specific
  lmp                DATE,                   -- Ob-Gyne: Last Menstrual Period

  -- Nurse notes
  chief_complaint    TEXT,
  nurse_notes        TEXT,

  -- Specialty this intake is for (where patient is going)
  routed_to_specialty_id INT REFERENCES specialties(specialty_id),

  recorded_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 6: MEDICAL RECORDS (Doctor-authored)              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Medical records are cumulative, doctor-authored clinical notes.
-- They reference vitals via vital_id (read-only link).
-- NO vitals data is stored here — vitals stay in the vitals table.
CREATE TABLE IF NOT EXISTS medical_records (
  record_id        SERIAL      PRIMARY KEY,
  patient_id       INT         NOT NULL REFERENCES patients(id)     ON DELETE CASCADE,
  appointment_id   INT                  REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_id        INT                  REFERENCES users(user_id),
  vital_id         INT                  REFERENCES vitals(vital_id) ON DELETE SET NULL,

  -- Clinical content (doctor fills these)
  visit_date       DATE,
  chief_complaint  TEXT,
  history_of_illness TEXT,
  physical_exam    TEXT,
  diagnosis        TEXT,
  treatment_plan   TEXT,
  prescriptions    TEXT,
  lab_requests     TEXT,
  doctor_notes     TEXT,

  -- Follow-up
  follow_up_date   DATE,
  follow_up_notes  TEXT,

  -- Audit
  is_confidential  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by       INT         NOT NULL REFERENCES users(user_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 7: QUEUE SYSTEM                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Queue entries are generated from CONFIRMED appointments.
-- Each specialty has its own numbered queue per day.
CREATE TABLE IF NOT EXISTS queue_entries (
  queue_id         SERIAL      PRIMARY KEY,
  appointment_id   INT         NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  specialty_id     INT                  REFERENCES specialties(specialty_id),

  queue_number     INT         NOT NULL,    -- Per-specialty, per-day sequential number
  queue_date       DATE        NOT NULL DEFAULT CURRENT_DATE,

  status           VARCHAR(20) NOT NULL DEFAULT 'WAITING',
  -- WAITING | CALLED | IN_PROGRESS | DONE | SKIPPED | NO_SHOW

  priority         INT         NOT NULL DEFAULT 0,  -- Higher = higher priority
  notes            TEXT,

  -- Timestamps
  called_at        TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_queue_status CHECK (
    status IN ('WAITING','CALLED','IN_PROGRESS','DONE','SKIPPED','NO_SHOW')
  ),
  -- Each specialty can have each queue number only once per day
  CONSTRAINT uq_queue_specialty_date_number UNIQUE (specialty_id, queue_date, queue_number)
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 8: BILLING                                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Billing is always PAID immediately when cashier processes payment.
-- OR number is auto-generated by generate_or_number() DB function.
CREATE TABLE IF NOT EXISTS billing (
  id               SERIAL       PRIMARY KEY,
  appointment_id   INT                   REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id       INT          NOT NULL REFERENCES patients(id),
  cashier_id       INT                   REFERENCES users(user_id),

  -- Official Receipt
  or_number        VARCHAR(30)  NOT NULL UNIQUE,  -- QEL-YYYY-NNNNN

  -- Line items stored as JSON array
  -- Each item: { description, quantity, unit_price, amount }
  line_items       JSONB        NOT NULL DEFAULT '[]'::jsonb,

  -- Discount
  discount_type    VARCHAR(30)  NOT NULL DEFAULT 'none',
  -- Allowed: none | senior | pwd | philhealth | hmo | other
  discount_pct     DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Totals
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(10,2) NOT NULL,

  -- Payment
  payment_method   VARCHAR(30)  NOT NULL DEFAULT 'cash',
  -- Allowed: cash | gcash | maya | card | philhealth | hmo
  amount_tendered  DECIMAL(10,2),
  change_amount    DECIMAL(10,2),

  -- Status
  status           VARCHAR(20)  NOT NULL DEFAULT 'PAID',
  -- Allowed: PAID | VOIDED

  notes            TEXT,
  paid_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  voided_at        TIMESTAMPTZ,
  voided_by        INT                   REFERENCES users(user_id),

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_billing_status CHECK (
    status IN ('PAID','VOIDED')
  ),
  CONSTRAINT chk_billing_discount_type CHECK (
    discount_type IN ('none','senior','pwd','philhealth','hmo','other')
  ),
  CONSTRAINT chk_billing_payment_method CHECK (
    payment_method IN ('cash','gcash','maya','card','philhealth','hmo')
  )
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 9: ACTIVITY LOGS                                  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Admin-visible audit trail. Only important events are logged.
-- NOT a debug log — surgical, meaningful entries only.
CREATE TABLE IF NOT EXISTS activity_logs (
  log_id       SERIAL       PRIMARY KEY,
  user_id      INT                   REFERENCES users(user_id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,
  -- Examples: LOGIN, LOGOUT, APPT_CREATED, APPT_STATUS_CHANGED,
  --           BILLING_PAID, BILLING_VOIDED, USER_CREATED,
  --           USER_STATUS_CHANGED, QUEUE_ENTRY_ADDED,
  --           PATIENT_REGISTERED, PASSWORD_RESET

  entity_type  VARCHAR(50),  -- 'appointment' | 'billing' | 'user' | 'patient' | 'queue'
  entity_id    INT,
  description  TEXT,
  ip_address   VARCHAR(45),
  metadata     JSONB,        -- extra structured data (or_number, role changes, etc.)

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECTION 10: INDEXES                                       ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role_id       ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status        ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(LOWER(email));

-- Active tokens
CREATE INDEX IF NOT EXISTS idx_tokens_user_id      ON active_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at   ON active_tokens(expires_at);

-- OTP
CREATE INDEX IF NOT EXISTS idx_otp_email           ON otp_requests(LOWER(email));

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_user_id    ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_is_active  ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_patients_name       ON patients(LOWER(last_name), LOWER(first_name));

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appts_patient_id    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appts_doctor_id     ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appts_specialty_id  ON appointments(specialty_id);
CREATE INDEX IF NOT EXISTS idx_appts_date          ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appts_status        ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appts_date_status   ON appointments(date, status);

-- Vitals
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id   ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_appt_id      ON vitals(appointment_id);

-- Medical records
CREATE INDEX IF NOT EXISTS idx_records_patient_id  ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_records_appt_id     ON medical_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_records_doctor_id   ON medical_records(doctor_id);

-- Queue
CREATE INDEX IF NOT EXISTS idx_queue_specialty_date ON queue_entries(specialty_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_status         ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_queue_appt_id        ON queue_entries(appointment_id);

-- Billing
CREATE INDEX IF NOT EXISTS idx_billing_patient_id  ON billing(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_appt_id     ON billing(appointment_id);
CREATE INDEX IF NOT EXISTS idx_billing_or_number   ON billing(or_number);
CREATE INDEX IF NOT EXISTS idx_billing_paid_at     ON billing(paid_at);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_logs_user_id        ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action         ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created_at     ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_entity         ON activity_logs(entity_type, entity_id);
