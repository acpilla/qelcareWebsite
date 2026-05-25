-- ============================================================
-- QELCARE SEED DATA
-- Run AFTER schema.sql AND functions.sql
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ROLES                                                      ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO roles (role_name) VALUES
  ('Admin'),
  ('Doctor'),
  ('Nurse'),
  ('Receptionist'),
  ('Cashier'),
  ('Patient')
ON CONFLICT (role_name) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SPECIALTIES                                               ║
-- ║  7 nurse queue screens → 7 specialties                     ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO specialties (specialty_name, slug, description, display_order) VALUES
  ('Cardiology',             'cardiology',        'Heart and cardiovascular system',              1),
  ('Gastroenterology',       'gastroenterology',  'Digestive system and gastrointestinal tract',  2),
  ('Ob-Gyne',                'ob-gyne',           'Obstetrics and Gynecology',                    3),
  ('Pediatrics',             'pediatrics',        'Medical care for infants, children, and teens',4),
  ('Psychiatry',             'psychiatry',        'Mental health and behavioral medicine',         5),
  ('Rehabilitation Medicine','rehab',             'Physical medicine and rehabilitation therapy',  6),
  ('ENT',                    'ent',               'Ear, Nose, and Throat (Otolaryngology)',        7)
ON CONFLICT (specialty_name) DO UPDATE SET
  slug          = EXCLUDED.slug,
  description   = EXCLUDED.description,
  display_order = EXCLUDED.display_order;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  OR NUMBER SEQUENCE — initialize current year              ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO or_number_seq (year, last_num)
VALUES (EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila')::INT, 0)
ON CONFLICT (year) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  DEFAULT ADMIN ACCOUNT                                     ║
-- ║  ⚠️  CHANGE PASSWORD ON FIRST LOGIN                        ║
-- ║  Default password: Admin@12345                             ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Bcrypt hash of 'Admin@12345' with 12 rounds
-- You can regenerate with: node -e "const b=require('bcrypt');b.hash('Admin@12345',12).then(console.log)"
DO $$
DECLARE
  v_role_id INT;
BEGIN
  SELECT role_id INTO v_role_id FROM roles WHERE role_name = 'Admin';

  INSERT INTO users (
    role_id, username, email, password,
    first_name, last_name, status
  )
  VALUES (
    v_role_id,
    'admin',
    'admin@qelcare.com',
    -- bcrypt hash of 'Admin@12345' with 12 rounds
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8XvtLvRWZjQmFlFUMeq',
    'System', 'Administrator',
    'verified'
  )
  ON CONFLICT (username) DO NOTHING;
END;
$$;
