-- ============================================================
-- QELCare Patient Mobile Compatibility Check
-- Run AFTER patient_mobile_patch.sql.
-- This script is read-only: it reports what the patient APK needs.
-- ============================================================

\echo ''
\echo 'QELCare Patient Mobile compatibility check'
\echo 'Expected result: every required table/column/role says OK; bookable_doctors should be > 0 for booking.'
\echo ''

WITH required_tables(table_name) AS (
  VALUES
    ('users'),
    ('roles'),
    ('active_tokens'),
    ('user_addresses'),
    ('patients'),
    ('appointments'),
    ('specialties'),
    ('medical_records'),
    ('vitals'),
    ('patient_medical_results'),
    ('otp_requests')
)
SELECT
  'table:' || table_name AS check_name,
  CASE WHEN to_regclass('public.' || table_name) IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM required_tables
ORDER BY table_name;

WITH required_columns(table_name, column_name) AS (
  VALUES
    ('users','user_id'), ('users','username'), ('users','email'), ('users','password'),
    ('users','first_name'), ('users','last_name'), ('users','phone'), ('users','alternate_phone'),
    ('users','gender'), ('users','date_of_birth'), ('users','profile_picture'), ('users','role_id'),
    ('users','status'), ('users','specialty_id'),

    ('roles','role_id'), ('roles','role_name'),

    ('user_addresses','user_id'), ('user_addresses','address_line'),

    ('patients','id'), ('patients','user_id'), ('patients','name'), ('patients','first_name'),
    ('patients','last_name'), ('patients','contact'), ('patients','phone'), ('patients','email'),
    ('patients','address'), ('patients','is_active'),

    ('appointments','id'), ('appointments','patient_id'), ('appointments','doctor_id'),
    ('appointments','specialty_id'), ('appointments','date'), ('appointments','time'),
    ('appointments','status'), ('appointments','type'), ('appointments','chief_complaint'),

    ('specialties','specialty_id'), ('specialties','specialty_name'), ('specialties','slug'),
    ('specialties','is_active'), ('specialties','display_order'),

    ('medical_records','record_id'), ('medical_records','patient_id'), ('medical_records','doctor_id'),
    ('medical_records','appointment_id'), ('medical_records','vital_id'), ('medical_records','visit_date'),
    ('medical_records','diagnosis'), ('medical_records','prescription'), ('medical_records','prescriptions'),
    ('medical_records','treatment_plan'), ('medical_records','lab_requests'), ('medical_records','doctor_notes'),

    ('vitals','id'), ('vitals','patient_id'), ('vitals','appointment_id'), ('vitals','nurse_id'),
    ('vitals','blood_pressure'), ('vitals','heart_rate'), ('vitals','temperature'), ('vitals','weight'),
    ('vitals','height'), ('vitals','oxygen_sat'), ('vitals','o2_saturation'), ('vitals','recorded_at'),

    ('patient_medical_results','result_id'), ('patient_medical_results','patient_id'),
    ('patient_medical_results','uploaded_by'), ('patient_medical_results','title'),
    ('patient_medical_results','result_type'), ('patient_medical_results','source_facility'),
    ('patient_medical_results','result_date'), ('patient_medical_results','extracted_text'),
    ('patient_medical_results','summary_notes'), ('patient_medical_results','file_url'),
    ('patient_medical_results','file_public_id'), ('patient_medical_results','file_mime'),
    ('patient_medical_results','deleted_at'),

    ('otp_requests','email'), ('otp_requests','otp_hash'), ('otp_requests','expires_at'),
    ('otp_requests','request_count'), ('otp_requests','last_request_at'), ('otp_requests','purpose'),
    ('otp_requests','used'), ('otp_requests','attempts'), ('otp_requests','created_at')
)
SELECT
  table_name || '.' || column_name AS check_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = rc.table_name
 AND c.column_name = rc.column_name
ORDER BY table_name, column_name;

WITH required_roles(role_name) AS (
  VALUES ('Patient'), ('Doctor'), ('Admin'), ('Nurse'), ('Cashier'), ('Frontdesk')
)
SELECT
  'role:' || rr.role_name AS check_name,
  CASE WHEN r.role_id IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result,
  r.role_id
FROM required_roles rr
LEFT JOIN roles r ON r.role_name = rr.role_name
ORDER BY rr.role_name;

SELECT
  'bookable_doctors' AS check_name,
  COUNT(*)::text AS result,
  'verified Doctor users with a non-null active specialty. Booking works best when this is greater than 0.' AS note
FROM users u
JOIN roles r ON u.role_id = r.role_id
LEFT JOIN specialties s ON u.specialty_id = s.specialty_id
WHERE r.role_name = 'Doctor'
  AND u.status = 'verified'
  AND u.specialty_id IS NOT NULL
  AND COALESCE(s.is_active, TRUE) = TRUE;

SELECT
  'linked_patient_accounts' AS check_name,
  COUNT(*)::text AS result,
  'patients rows linked to Patient-role users. Existing patient logins need this link.' AS note
FROM patients p
JOIN users u ON p.user_id = u.user_id
JOIN roles r ON u.role_id = r.role_id
WHERE r.role_name = 'Patient';

WITH otp_constraints AS (
  SELECT COALESCE(string_agg(pg_get_constraintdef(oid), ' | '), '') AS defs
  FROM pg_constraint
  WHERE conrelid = to_regclass('public.otp_requests')
    AND contype = 'c'
)
SELECT
  'otp_purpose_mobile_constraint' AS check_name,
  CASE
    WHEN defs ILIKE '%password_reset%'
     AND defs ILIKE '%registration%'
     AND defs ILIKE '%email_verification%'
     AND defs ILIKE '%profile_update%'
    THEN 'OK'
    ELSE 'PATCH REQUIRED'
  END AS result,
  defs AS constraint_definitions
FROM otp_constraints;

SELECT
  'patient_medical_results_rows' AS check_name,
  COUNT(*)::text AS result,
  'existing uploaded lab/result rows visible to linked patient accounts' AS note
FROM patient_medical_results
WHERE deleted_at IS NULL;
