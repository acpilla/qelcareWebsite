-- Optional cleanup for a restored qelcaresql-V7.sql copy.
-- Do NOT run this on production unless you intentionally want to log out all users
-- and clear pending OTP requests.
-- Recommended only after restoring a full data dump into local/dev/staging.

BEGIN;
TRUNCATE TABLE active_tokens RESTART IDENTITY;
DELETE FROM otp_requests;
COMMIT;

SELECT 'cleared_active_tokens_and_otp_requests' AS action, NOW() AS ran_at;
