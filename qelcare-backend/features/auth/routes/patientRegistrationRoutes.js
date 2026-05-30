const router = require("express").Router();
const bcrypt = require("bcrypt");
const pool = require("../../../config/database");
const logger = require("../../../shared/utils/activityLogger");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

const OTP_PURPOSE_REGISTRATION = "registration";
const OTP_PURPOSE_PROFILE = "profile_update";

// Lengths match the uploaded qelcaresql-V7.sql users table.
const LIMITS = {
  username: 50,
  email: 100,
  first_name: 50,
  last_name: 50,
  middle_name: 50,
  suffix: 10,
  phone: 20,
  alternate_phone: 20,
  gender: 10,
};

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validUsername(value) {
  return new RegExp(`^[a-zA-Z0-9._-]{3,${LIMITS.username}}$`).test(value);
}

function addMaxLengthError(errors, label, value, max) {
  if (value && String(value).length > max) errors.push(`${label} must be ${max} characters or less.`);
}

function validateSqlLengths(errors, fields) {
  addMaxLengthError(errors, "Username", fields.username, LIMITS.username);
  addMaxLengthError(errors, "Email", fields.email, LIMITS.email);
  addMaxLengthError(errors, "First name", fields.firstName, LIMITS.first_name);
  addMaxLengthError(errors, "Last name", fields.lastName, LIMITS.last_name);
  addMaxLengthError(errors, "Middle name", fields.middleName, LIMITS.middle_name);
  addMaxLengthError(errors, "Suffix", fields.suffix, LIMITS.suffix);
  addMaxLengthError(errors, "Phone", fields.phone, LIMITS.phone);
  addMaxLengthError(errors, "Alternate phone", fields.alternatePhone, LIMITS.alternate_phone);
  addMaxLengthError(errors, "Gender", fields.gender, LIMITS.gender);
}

function validatePassword(password) {
  const text = String(password || "");
  const errors = [];
  if (text.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[a-z]/.test(text)) errors.push("Password must contain a lowercase letter.");
  if (!/[A-Z]/.test(text)) errors.push("Password must contain an uppercase letter.");
  if (!/\d/.test(text)) errors.push("Password must contain a number.");
  if (!/[@$!%*?&#]/.test(text)) errors.push("Password must contain a special character.");
  return errors;
}

function validOtpCode(code) {
  return /^\d{6}$/.test(String(code || ""));
}

async function sendBrevoEmail({ to, firstName, otp, subject = "QELCare - Your Verification Code" }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || "QELCare System",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to }],
      subject,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;background:#f5f8fc;padding:20px;">
          <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #dbe6f3;">
            <div style="background:#0f766e;color:#fff;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:26px;">QELCare</h1>
              <p style="margin:6px 0 0;">Patient verification code</p>
            </div>
            <div style="padding:26px;">
              <p>Hello ${firstName || "Patient"},</p>
              <p>Use this code to continue:</p>
              <div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#0f766e;text-align:center;border:2px solid #0f766e;border-radius:12px;padding:16px;margin:20px 0;">${otp}</div>
              <p>This code expires in <strong>2 minutes</strong>.</p>
              <p style="font-size:12px;color:#718096;">If you did not request this, please ignore this email or contact the clinic.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (response.status === 429) throw new Error("BREVO_RATE_LIMITED");
  if (!response.ok) {
    let details = "";
    try { details = JSON.stringify(await response.json()); } catch (_) { details = await response.text(); }
    throw new Error(`BREVO_ERROR: ${details}`);
  }
}

async function writeOtp({ email, purpose, firstName, subject }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await pool.query(
    `SELECT email,
            request_count,
            last_request_at,
            (last_request_at::date = CURRENT_DATE) AS is_same_day,
            EXTRACT(EPOCH FROM (NOW() - last_request_at)) AS seconds_since_last
     FROM otp_requests
     WHERE LOWER(email) = LOWER($1)
     ORDER BY last_request_at DESC
     LIMIT 1`,
    [normalizedEmail]
  );

  let requestCount = 1;
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.seconds_since_last !== null && Number(row.seconds_since_last) < 60) {
      const remaining = Math.ceil(60 - Number(row.seconds_since_last));
      return {
        success: false,
        status: 429,
        message: `Please wait ${remaining} second${remaining === 1 ? "" : "s"} before requesting a new code.`,
      };
    }

    requestCount = row.is_same_day ? Number(row.request_count || 0) + 1 : 1;
    if (requestCount > 10) {
      return {
        success: false,
        status: 429,
        message: "Maximum OTP requests reached. Try again tomorrow or contact the clinic.",
      };
    }
  }

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);

  // qelcaresql-V7 keys OTP by email. Normalize case before ON CONFLICT so
  // existing mixed-case OTP rows cannot create duplicate lower-case rows.
  await pool.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND email <> $1", [normalizedEmail]);

  await pool.query(
    `INSERT INTO otp_requests (email, otp_hash, expires_at, request_count, last_request_at, purpose, used, attempts, created_at)
     VALUES ($1, $2, NOW() + INTERVAL '2 minutes', $3, NOW(), $4, FALSE, 0, NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       otp_hash = EXCLUDED.otp_hash,
       expires_at = EXCLUDED.expires_at,
       request_count = EXCLUDED.request_count,
       last_request_at = EXCLUDED.last_request_at,
       purpose = EXCLUDED.purpose,
       used = FALSE,
       attempts = 0,
       created_at = NOW()`,
    [normalizedEmail, otpHash, requestCount, purpose]
  );

  try {
    await sendBrevoEmail({ to: normalizedEmail, firstName, otp, subject });
  } catch (err) {
    await pool.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
    if (err.message === "BREVO_NOT_CONFIGURED") {
      return { success: false, status: 503, message: "Email service is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL." };
    }
    if (err.message === "BREVO_RATE_LIMITED") {
      return { success: false, status: 429, message: "Email service is busy. Please wait and try again." };
    }
    console.error("Patient mobile OTP email error:", err);
    return { success: false, status: 502, message: "Failed to send verification code." };
  }

  return { success: true, status: 200, message: "Verification code sent." };
}

async function verifyOtp({ client = pool, email, code, purpose, deleteOnSuccess = true }) {
  const normalizedEmail = normalizeEmail(email);
  if (!validOtpCode(code)) {
    return { success: false, status: 400, message: "Enter the 6-digit verification code." };
  }

  const result = await client.query(
    `SELECT otp_hash, expires_at < NOW() AS is_expired
     FROM otp_requests
     WHERE LOWER(email) = LOWER($1) AND purpose = $2`,
    [normalizedEmail, purpose]
  );

  if (result.rows.length === 0) {
    return { success: false, status: 400, message: "No verification code found. Request a new one." };
  }

  if (result.rows[0].is_expired) {
    await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
    return { success: false, status: 400, message: "Verification code expired. Request a new one." };
  }

  const valid = await bcrypt.compare(String(code), result.rows[0].otp_hash);
  if (!valid) return { success: false, status: 400, message: "Invalid verification code." };

  if (deleteOnSuccess) {
    await client.query("DELETE FROM otp_requests WHERE LOWER(email) = LOWER($1) AND purpose = $2", [normalizedEmail, purpose]);
  }

  return { success: true, status: 200, message: "Verification code accepted." };
}

async function getPatientRoleId(client = pool) {
  const role = await client.query("SELECT role_id FROM roles WHERE role_name = 'Patient'");
  if (role.rows[0]?.role_id) return role.rows[0].role_id;
  const inserted = await client.query("INSERT INTO roles (role_name) VALUES ('Patient') RETURNING role_id");
  return inserted.rows[0].role_id;
}

router.post("/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const username = clean(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const firstName = clean(req.body.first_name);
    const lastName = clean(req.body.last_name);
    const phone = clean(req.body.phone);
    const dateOfBirth = clean(req.body.date_of_birth) || null;

    const errors = [];
    if (!username) errors.push("Username is required.");
    if (username && !validUsername(username)) errors.push("Username must be 3-50 characters and may contain letters, numbers, dot, underscore, or hyphen.");
    if (!email || !isEmail(email)) errors.push("A valid email is required.");
    if (!firstName) errors.push("First name is required.");
    if (!lastName) errors.push("Last name is required.");
    validateSqlLengths(errors, { username, email, firstName, lastName, phone });
    errors.push(...validatePassword(password));
    if (errors.length > 0) return res.status(400).json({ success: false, errors, message: errors[0] });

    await client.query("BEGIN");
    const patientRoleId = await getPatientRoleId(client);

    const duplicate = await client.query(
      "SELECT user_id, username, email FROM users WHERE username = $1 OR LOWER(email) = LOWER($2)",
      [username, email]
    );
    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Username or email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users
         (role_id, username, email, password, first_name, last_name, phone, date_of_birth, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, 'unverified', NOW(), NOW())
       RETURNING user_id, username, email, first_name, last_name, phone, date_of_birth, status`,
      [patientRoleId, username, email, hashedPassword, firstName, lastName, phone || null, dateOfBirth]
    );

    await client.query("COMMIT");

    const user = userResult.rows[0];
    const otpResult = await writeOtp({
      email,
      purpose: OTP_PURPOSE_REGISTRATION,
      firstName,
      subject: "QELCare - Patient Registration Verification Code",
    });

    await logger.log({
      userId: user.user_id,
      action: "PATIENT_REGISTERED",
      entityType: "user",
      entityId: user.user_id,
      description: `${username} created a patient account and is awaiting email verification.`,
      ip: logger.getIP(req),
      metadata: { email, otp_sent: otpResult.success },
    });

    return res.status(201).json({
      success: true,
      message: otpResult.success
        ? "Patient account created. Verification code sent to your email."
        : `Patient account created, but the verification email could not be sent: ${otpResult.message}`,
      data: { user_id: user.user_id, username: user.username, email: user.email, status: user.status },
      otp_sent: otpResult.success,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Patient register error:", err);
    return res.status(500).json({ success: false, message: "Failed to register patient account." });
  } finally {
    client.release();
  }
});

router.post("/register/resend", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isEmail(email)) return res.status(400).json({ success: false, message: "A valid email is required." });

    const userResult = await pool.query(
      `SELECT u.user_id, u.email, u.first_name, u.status
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE LOWER(u.email) = LOWER($1) AND r.role_name = 'Patient'`,
      [email]
    );

    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ success: false, message: "Patient account not found." });
    if (user.status === "verified") return res.status(400).json({ success: false, message: "Account is already verified." });

    const result = await writeOtp({
      email,
      purpose: OTP_PURPOSE_REGISTRATION,
      firstName: user.first_name,
      subject: "QELCare - Patient Registration Verification Code",
    });

    return res.status(result.status).json({ success: result.success, message: result.message });
  } catch (err) {
    console.error("Resend patient registration OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to resend verification code." });
  }
});

router.post("/register/verify", async (req, res) => {
  const client = await pool.connect();
  try {
    const email = normalizeEmail(req.body.email);
    const code = clean(req.body.code);
    if (!email || !isEmail(email)) return res.status(400).json({ success: false, message: "A valid email is required." });

    await client.query("BEGIN");
    const otp = await verifyOtp({ client, email, code, purpose: OTP_PURPOSE_REGISTRATION, deleteOnSuccess: true });
    if (!otp.success) {
      await client.query("ROLLBACK");
      return res.status(otp.status).json({ success: false, message: otp.message });
    }

    const userResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.date_of_birth, u.status
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE LOWER(u.email) = LOWER($1) AND r.role_name = 'Patient'`,
      [email]
    );

    const user = userResult.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Patient account not found." });
    }

    await client.query(
      `UPDATE users
       SET status = 'verified', failed_login_attempts = 0, lockout_until = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [user.user_id]
    );

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    await client.query(
      `INSERT INTO patients
         (user_id, first_name, last_name, name, email, phone, contact, date_of_birth, is_active, created_by, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $6, $7, TRUE, $1, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         contact = EXCLUDED.contact,
         date_of_birth = EXCLUDED.date_of_birth,
         is_active = TRUE,
         updated_at = NOW()`,
      [user.user_id, user.first_name || "", user.last_name || "", fullName, user.email, user.phone || null, user.date_of_birth || null]
    );

    await client.query("COMMIT");

    await logger.log({
      userId: user.user_id,
      action: "PATIENT_VERIFIED",
      entityType: "user",
      entityId: user.user_id,
      description: `${user.username} verified their patient account.`,
      ip: logger.getIP(req),
    });

    return res.json({ success: true, message: "Patient account verified. You can now sign in." });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Verify patient registration error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify patient account." });
  } finally {
    client.release();
  }
});

router.post("/profile/otp", authenticate, authorize(["Patient"]), async (req, res) => {
  try {
    const userResult = await pool.query("SELECT email, first_name FROM users WHERE user_id = $1", [req.user.user_id]);
    const user = userResult.rows[0];
    if (!user?.email) return res.status(404).json({ success: false, message: "Account email not found." });

    const result = await writeOtp({
      email: user.email,
      purpose: OTP_PURPOSE_PROFILE,
      firstName: user.first_name,
      subject: "QELCare - Profile Update Verification Code",
    });
    return res.status(result.status).json({ success: result.success, message: result.message });
  } catch (err) {
    console.error("Profile OTP send error:", err);
    return res.status(500).json({ success: false, message: "Failed to send profile update code." });
  }
});

router.post("/profile/otp/check", authenticate, authorize(["Patient"]), async (req, res) => {
  try {
    const userResult = await pool.query("SELECT email FROM users WHERE user_id = $1", [req.user.user_id]);
    const email = userResult.rows[0]?.email;
    if (!email) return res.status(404).json({ success: false, message: "Account email not found." });

    const result = await verifyOtp({ email, code: clean(req.body.code), purpose: OTP_PURPOSE_PROFILE, deleteOnSuccess: false });
    return res.status(result.status).json({ success: result.success, message: result.message });
  } catch (err) {
    console.error("Profile OTP check error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify profile update code." });
  }
});

router.put("/profile", authenticate, authorize(["Patient"]), async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.user_id;
    const username = clean(req.body.username);
    const email = normalizeEmail(req.body.email);
    const firstName = clean(req.body.first_name);
    const lastName = clean(req.body.last_name);
    const middleName = clean(req.body.middle_name);
    const suffix = clean(req.body.suffix);
    const phone = clean(req.body.phone);
    const alternatePhone = clean(req.body.alternate_phone);
    const gender = clean(req.body.gender) || null;
    const dateOfBirth = clean(req.body.date_of_birth) || null;
    const addressLine = clean(req.body.address_line);
    const otpCode = clean(req.body.otp_code);

    const errors = [];
    if (!username) errors.push("Username is required.");
    if (username && !validUsername(username)) errors.push("Username must be 3-50 characters and may contain letters, numbers, dot, underscore, or hyphen.");
    if (!email || !isEmail(email)) errors.push("A valid email is required.");
    if (!firstName) errors.push("First name is required.");
    if (!lastName) errors.push("Last name is required.");
    if (gender && !["Male", "Female", "Other"].includes(gender)) errors.push("Invalid gender.");
    validateSqlLengths(errors, { username, email, firstName, lastName, middleName, suffix, phone, alternatePhone, gender });
    if (errors.length > 0) return res.status(400).json({ success: false, errors, message: errors[0] });

    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.phone, u.alternate_phone, ua.address_line
       FROM users u
       LEFT JOIN user_addresses ua ON ua.user_id = u.user_id
       WHERE u.user_id = $1`,
      [userId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const sensitiveChanged = [
      [username, current.username],
      [email, current.email],
      [phone, current.phone],
      [alternatePhone, current.alternate_phone],
      [addressLine, current.address_line],
    ].some(([next, prev]) => String(next || "").trim() !== String(prev || "").trim());

    if (sensitiveChanged) {
      const otp = await verifyOtp({ client, email: current.email, code: otpCode, purpose: OTP_PURPOSE_PROFILE, deleteOnSuccess: true });
      if (!otp.success) {
        await client.query("ROLLBACK");
        return res.status(otp.status).json({ success: false, message: otp.message });
      }
    }

    const duplicate = await client.query(
      `SELECT user_id FROM users
       WHERE user_id <> $1 AND (username = $2 OR LOWER(email) = LOWER($3))`,
      [userId, username, email]
    );
    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Username or email is already used by another account." });
    }

    await client.query(
      `UPDATE users
       SET username = $2,
           email = $3,
           first_name = $4,
           last_name = $5,
           middle_name = $6,
           suffix = $7,
           phone = $8,
           alternate_phone = $9,
           gender = $10,
           date_of_birth = $11,
           email_changed_at = CASE WHEN LOWER(email) <> LOWER($3) THEN NOW() ELSE email_changed_at END,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, username, email, firstName, lastName, middleName || null, suffix || null, phone || null, alternatePhone || null, gender, dateOfBirth]
    );

    await client.query(
      `INSERT INTO user_addresses (user_id, address_line)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET address_line = EXCLUDED.address_line, updated_at = NOW()`,
      [userId, addressLine || null]
    );

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    await client.query(
      `INSERT INTO patients
         (user_id, first_name, last_name, middle_name, suffix, name, email, phone, contact, gender, date_of_birth, address, is_active, created_by, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, TRUE, $1, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         middle_name = EXCLUDED.middle_name,
         suffix = EXCLUDED.suffix,
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         contact = EXCLUDED.contact,
         gender = EXCLUDED.gender,
         date_of_birth = EXCLUDED.date_of_birth,
         address = EXCLUDED.address,
         is_active = TRUE,
         updated_at = NOW()`,
      [userId, firstName, lastName, middleName || null, suffix || null, fullName, email, phone || null, gender, dateOfBirth, addressLine || null]
    );

    const updated = await client.query(
      `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.middle_name, u.suffix,
              u.phone, u.alternate_phone, u.gender, u.date_of_birth, u.profile_picture,
              ua.address_line
       FROM users u
       LEFT JOIN user_addresses ua ON ua.user_id = u.user_id
       WHERE u.user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    await logger.log({
      userId,
      action: "PROFILE_UPDATED",
      entityType: "user",
      entityId: userId,
      description: `${username} updated their patient mobile profile.`,
      ip: logger.getIP(req),
      metadata: { sensitive_changed: sensitiveChanged },
    });

    return res.json({ success: true, message: "Profile updated.", data: updated.rows[0] });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Patient profile update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  } finally {
    client.release();
  }
});

module.exports = router;
