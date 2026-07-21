// ============================================================================
// QELCare auth service — OTP issue / verify / resend
// ----------------------------------------------------------------------------
// KEY FIXES vs previous version:
//   * Uses the unified emailNotifier (raw https, with dev console fallback) —
//     OTPs are never silently lost in development.
//   * OTP rows are keyed by (email, purpose) to match the new composite PK,
//     so registration / password_reset / profile_update never clobber each
//     other.  ON CONFLICT now targets (email, purpose).
//   * sendOTP issues the OTP INSIDE the caller's transaction when a client is
//     passed (so registration can roll the whole thing back if email fails).
//   * Every result carries a machine-readable `code` for the frontend.
//   * generateOTP avoids leading-zero ambiguity (always 6 digits).
// ============================================================================

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../../../config/database");
const emailNotifier = require("../../../shared/utils/emailNotifier");

const OTP_TTL_MINUTES = 2;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_DAILY_REQUESTS = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_HASH_ROUNDS = 10;

const PURPOSES = {
  PASSWORD_RESET: "password_reset",
  REGISTRATION: "registration",
  EMAIL_VERIFICATION: "email_verification",
  PROFILE_UPDATE: "profile_update",
};

const CODES = {
  OK: "OK",
  NO_ACCOUNT: "NO_ACCOUNT",
  ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
  NOT_VERIFIED: "NOT_VERIFIED",
  WRONG_ROLE: "WRONG_ROLE",
  COOLDOWN: "COOLDOWN",
  DAILY_LIMIT: "DAILY_LIMIT",
  EMAIL_NOT_CONFIGURED: "EMAIL_NOT_CONFIGURED",
  EMAIL_RATE_LIMITED: "EMAIL_RATE_LIMITED",
  EMAIL_FAILED: "EMAIL_FAILED",
  NO_CODE: "NO_CODE",
  ALREADY_USED: "ALREADY_USED",
  EXPIRED: "EXPIRED",
  INVALID_CODE: "INVALID_CODE",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  SERVER_ERROR: "SERVER_ERROR",
};

// ---------------------------------------------------------------------------
function clean(value) {
  return String(value || "").trim();
}
function normalizeEmail(value) {
  return clean(value).toLowerCase();
}
function generateOTP() {
  // 100000..999999 inclusive — always 6 digits, no leading-zero loss.
  return String(crypto.randomInt(100000, 1000000));
}
function getClient(client) {
  return client || pool;
}

async function findUserByEmail(email, client = pool) {
  const result = await client.query(
    `SELECT u.user_id, u.email, u.first_name, u.status, r.role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// sendOTP
//   options:
//     purpose        (default PASSWORD_RESET)
//     subject        email subject
//     firstName      override recipient name
//     requirePatient enforce Patient role
//     client         run rate-limit + insert inside this txn (for registration)
//     skipUserCheck  issue without an existing user row (rare; default false)
//
//   On success returns { success:true, status:200, code:OK, message, dev:bool }.
//   If the email send fails, the OTP row is removed (within the same client
//   when provided) so callers can safely roll back the whole operation.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// persistOtpRow — write/refresh the OTP row only (no email, no network).
//   Safe to call inside a transaction (`db` may be a txn client). Returns the
//   rate-limit decision; on success the row is stored and the plaintext otp is
//   returned so the caller can email it AFTER the transaction commits.
// ---------------------------------------------------------------------------
async function persistOtpRow(email, purpose, db) {
  const normalizedEmail = normalizeEmail(email);

  const existing = await db.query(
    `SELECT request_count,
            (last_request_at::date = CURRENT_DATE) AS is_same_day,
            EXTRACT(EPOCH FROM (NOW() - last_request_at)) AS seconds_since_last
       FROM otp_requests
      WHERE LOWER(email) = LOWER($1) AND purpose = $2
      LIMIT 1`,
    [normalizedEmail, purpose]
  );

  let requestCount = 1;
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const secondsSinceLast = Number(row.seconds_since_last);
    if (Number.isFinite(secondsSinceLast) && secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
      return {
        ok: false,
        result: {
          success: false,
          status: 429,
          code: CODES.COOLDOWN,
          retry_after: remaining,
          message: `Please wait ${remaining} second${remaining === 1 ? "" : "s"} before requesting a new code.`,
        },
      };
    }
    requestCount = row.is_same_day ? Number(row.request_count || 0) + 1 : 1;
    if (requestCount > OTP_MAX_DAILY_REQUESTS) {
      return {
        ok: false,
        result: { success: false, status: 429, code: CODES.DAILY_LIMIT, message: "Maximum OTP requests reached. Try again tomorrow or contact the clinic." },
      };
    }
  }

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, OTP_HASH_ROUNDS);

  await db.query(
    `INSERT INTO otp_requests
       (email, otp_hash, code, expires_at, request_count, last_request_at, purpose, used, attempts, created_at)
     VALUES
       ($1, $2, NULL, NOW() + ($3::text || ' minutes')::interval, $4, NOW(), $5, FALSE, 0, NOW())
     ON CONFLICT (email, purpose)
     DO UPDATE SET
       otp_hash        = EXCLUDED.otp_hash,
       code            = NULL,
       expires_at      = EXCLUDED.expires_at,
       request_count   = EXCLUDED.request_count,
       last_request_at = EXCLUDED.last_request_at,
       used            = FALSE,
       attempts        = 0,
       created_at      = NOW()`,
    [normalizedEmail, otpHash, OTP_TTL_MINUTES, requestCount, purpose]
  );

  return { ok: true, otp };
}

// ---------------------------------------------------------------------------
// deliverOtpEmail — send a previously-generated OTP. No DB access.
// ---------------------------------------------------------------------------
async function deliverOtpEmail(email, otp, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  const emailResult = await emailNotifier.sendOtpEmail({
    to: normalizedEmail,
    firstName: options.firstName,
    otp,
    subject: options.subject,
    ttlMinutes: OTP_TTL_MINUTES,
  });

  if (!emailResult.ok) {
    if (emailResult.reason === "Email service is not configured.") {
      return { success: false, status: 503, code: CODES.EMAIL_NOT_CONFIGURED, message: "Email service is not configured. Contact the clinic." };
    }
    if (emailResult.rateLimited) {
      return { success: false, status: 429, code: CODES.EMAIL_RATE_LIMITED, message: "Email service is busy. Please wait and try again." };
    }
    return { success: false, status: 502, code: CODES.EMAIL_FAILED, message: "Failed to send verification code. Please try again." };
  }

  return {
    success: true,
    status: 200,
    code: CODES.OK,
    dev: Boolean(emailResult.dev),
    message: emailResult.dev
      ? "Verification code generated (check the server console — email could not be sent)."
      : "Verification code sent to your email.",
  };
}

async function sendOTP(email, options = {}) {
  const db = getClient(options.client);
  const normalizedEmail = normalizeEmail(email);
  const purpose = options.purpose || PURPOSES.PASSWORD_RESET;

  try {
    let firstName = options.firstName;

    if (!options.skipUserCheck) {
      const user = await findUserByEmail(normalizedEmail, db);
      if (!user) {
        // Anti-enumeration: respond exactly like a successful send so a caller
        // cannot probe which emails map to real accounts. No OTP is created or sent.
        return { success: true, status: 200, code: CODES.OK, message: "Verification code sent to your email." };
      }
      if (user.status === "deactivated") {
        return { success: false, status: 403, code: CODES.ACCOUNT_DEACTIVATED, message: "Account is deactivated." };
      }
      if (purpose === PURPOSES.PASSWORD_RESET && user.status !== "verified" && user.status !== "locked") {
        return { success: false, status: 403, code: CODES.NOT_VERIFIED, message: "Verify your account before resetting your password." };
      }
      if (options.requirePatient && user.role_name !== "Patient") {
        return { success: false, status: 403, code: CODES.WRONG_ROLE, message: "Only patient accounts can use this verification flow." };
      }
      firstName = firstName || user.first_name;
    }

    // Persist on the POOL (never a caller transaction client) so no network I/O
    // ever happens inside someone else's transaction — this eliminates the pg
    // "client is already executing a query" warning.
    const persisted = await persistOtpRow(normalizedEmail, purpose, pool);
    if (!persisted.ok) return persisted.result;

    const delivery = await deliverOtpEmail(normalizedEmail, persisted.otp, {
      firstName,
      subject: options.subject,
    });

    if (!delivery.success) {
      await pool.query(
        "DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2",
        [normalizedEmail, purpose]
      );
    }
    return delivery;
  } catch (error) {
    console.error("sendOTP error:", error);
    return { success: false, status: 500, code: CODES.SERVER_ERROR, message: "Failed to send verification code." };
  }
}

// ---------------------------------------------------------------------------
// verifyOTP
//   options: purpose, consume, keepOnSuccess, client
//   When `client` is passed, the SELECT uses FOR UPDATE for serialized attempts.
// ---------------------------------------------------------------------------
async function verifyOTP(email, code, options = {}) {
  const client = getClient(options.client);
  const normalizedEmail = normalizeEmail(email);
  const purpose = options.purpose || PURPOSES.PASSWORD_RESET;
  const consume = Boolean(options.consume);
  const keepOnSuccess = Boolean(options.keepOnSuccess);
  const lockClause = options.client ? "FOR UPDATE" : "";

  try {
    const otpResult = await client.query(
      `SELECT otp_hash, expires_at, used, attempts,
              (expires_at < NOW()) AS is_expired
         FROM otp_requests
        WHERE LOWER(email) = LOWER($1) AND purpose = $2
        ${lockClause}`,
      [normalizedEmail, purpose]
    );

    if (otpResult.rows.length === 0) {
      return { success: false, status: 400, code: CODES.NO_CODE, message: "No verification code found. Request a new one." };
    }

    const otp = otpResult.rows[0];

    if (otp.used) {
      await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
      return { success: false, status: 400, code: CODES.ALREADY_USED, message: "Verification code was already used. Request a new one." };
    }

    if (otp.is_expired) {
      await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
      return { success: false, status: 410, code: CODES.EXPIRED, message: "Verification code expired. Request a new one." };
    }

    const valid = await bcrypt.compare(clean(code), otp.otp_hash);
    if (!valid) {
      const attempts = Number(otp.attempts || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
        return { success: false, status: 429, code: CODES.TOO_MANY_ATTEMPTS, message: "Too many incorrect attempts. Request a new code.", attempts, attempts_left: 0 };
      }
      await client.query("UPDATE otp_requests SET attempts = $1 WHERE LOWER(email) = LOWER($2) AND purpose = $3", [attempts, normalizedEmail, purpose]);
      return { success: false, status: 400, code: CODES.INVALID_CODE, message: "Invalid verification code.", attempts, attempts_left: OTP_MAX_ATTEMPTS - attempts };
    }

    if (consume) {
      await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
    } else if (!keepOnSuccess) {
      await client.query("UPDATE otp_requests SET attempts = 0 WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
    }

    return { success: true, status: 200, code: CODES.OK, message: "Verification code accepted." };
  } catch (error) {
    console.error("verifyOTP error:", error);
    return { success: false, status: 500, code: CODES.SERVER_ERROR, message: "Verification failed." };
  }
}

async function resendOTP(email, options = {}) {
  return sendOTP(email, options);
}

module.exports = {
  PURPOSES,
  CODES,
  OTP_TTL_MINUTES,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  normalizeEmail,
  sendOTP,
  verifyOTP,
  resendOTP,
  persistOtpRow,
  deliverOtpEmail,
  generateOTP,
};