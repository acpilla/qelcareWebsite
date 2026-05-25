# QELCare Database — Phase 1

## Option A: Fresh Database (no existing tables)
Run in this order:
```bash
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f functions.sql
psql $DATABASE_URL -f seed.sql
```

## Option B: Existing Database (RECOMMENDED — your case)
Run only the migration script. It is fully idempotent (safe to re-run):
```bash
psql $DATABASE_URL -f migrate_phase1.sql
psql $DATABASE_URL -f functions.sql
psql $DATABASE_URL -f seed.sql
```

## Using psql with Railway
```bash
# Your Railway connection string format:
psql "postgresql://postgres:PASSWORD@switchyard.proxy.rlwy.net:51088/railway" -f migrate_phase1.sql
psql "postgresql://postgres:PASSWORD@switchyard.proxy.rlwy.net:51088/railway" -f functions.sql
psql "postgresql://postgres:PASSWORD@switchyard.proxy.rlwy.net:51088/railway" -f seed.sql
```

## Verify after running
```sql
-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check roles
SELECT * FROM roles ORDER BY role_id;

-- Check specialties
SELECT specialty_id, specialty_name, slug FROM specialties ORDER BY display_order;

-- Test OR number generator
SELECT generate_or_number();
SELECT generate_or_number();
SELECT generate_or_number();

-- Test queue number generator
-- (Requires at least one specialty in DB)
SELECT generate_queue_number(1);
```

## What Changed (vs previous schema)

| Change | Reason |
|--------|--------|
| `user_addresses` got `UNIQUE(user_id)` constraint | Required for ON CONFLICT to work in updateProfile |
| `otp_requests` got `purpose` column | Distinguish registration OTP from password-reset OTP |
| `vitals` columns removed from `medical_records` | Vitals are nurse-only, stored in vitals table only |
| `medical_records` got `vital_id` FK | Links to nurse vitals without duplicating data |
| `billing` got `subtotal`, `voided_at`, `voided_by` | Complete billing audit trail |
| `billing` got `or_number` via `generate_or_number()` | QEL-YYYY-NNNNN format, auto-generated |
| `queue_entries` got `priority`, timestamps | Full queue lifecycle tracking |
| `specialties` got `slug` column | URL routing for nurse queue screens |
| `Receptionist` role added | Previously missing from roles table |
| All triggers installed | BMI auto-compute, patient auto-create, updated_at sync |

## Default Admin Account
- Username: `admin`
- Password: `Admin@12345`
- **Change this immediately on first login.**

## OR Number Format
`QEL-YYYY-NNNNN`
- QEL = QELCare prefix
- YYYY = current year (resets per year)
- NNNNN = 5-digit sequential (e.g. 00001)
- Example: `QEL-2025-00042`
