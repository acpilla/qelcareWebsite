const bcrypt = require("bcrypt");
const pool = require("../../../config/database");

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendBrevoEmail({ to, firstName, otp }) {
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
      subject: "QELCare - Your Verification Code",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0f766e 0%, #134e4a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 3px solid #0f766e; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 36px; font-weight: bold; color: #0f766e; letter-spacing: 8px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🏥 QELCARE</h1><p>Clinic Management System</p></div>
            <div class="content">
              <h2>Verification Code</h2>
              <p>Hello ${firstName || "User"},</p>
              <p>Here is your verification code:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p>This code expires in <strong>2 minutes</strong>.</p>
              <p style="color:#888;font-size:12px;">If you did not request this, please ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (response.status === 429) throw new Error("BREVO_RATE_LIMITED");
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Brevo error: ${JSON.stringify(err)}`);
  }
  return true;
}

// ============================================================
// SEND OTP
// ============================================================
async function sendOTP(email) {
  try {
    const userCheck = await pool.query(
      "SELECT email, first_name FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userCheck.rows.length === 0) {
      return { success: false, message: "No account found with this email address" };
    }

    const user = userCheck.rows[0];

    const otpRow = await pool.query(
      `SELECT request_count,
              last_request_at,
              (last_request_at::date = CURRENT_DATE) AS is_same_day,
              EXTRACT(EPOCH FROM (NOW() - last_request_at)) AS seconds_since_last
       FROM otp_requests WHERE email = $1`,
      [email]
    );

    let requestCount = 1;

    if (otpRow.rows.length > 0) {
      const record = otpRow.rows[0];

      if (record.seconds_since_last !== null && record.seconds_since_last < 60) {
        const remaining = Math.ceil(60 - record.seconds_since_last);
        return {
          success: false,
          message: `Please wait ${remaining} second${remaining !== 1 ? "s" : ""} before requesting a new code.`,
        };
      }

      requestCount = record.is_same_day ? record.request_count + 1 : 1;

      if (requestCount > 10) {
        return {
          success: false,
          message: "Maximum OTP requests reached. Try again tomorrow or contact administrator.",
        };
      }
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    await pool.query(
      `INSERT INTO otp_requests (email, otp_hash, expires_at, request_count, last_request_at)
       VALUES ($1, $2, NOW() + INTERVAL '2 minutes', $3, CURRENT_TIMESTAMP)
       ON CONFLICT (email)
       DO UPDATE SET
         otp_hash = EXCLUDED.otp_hash,
         expires_at = EXCLUDED.expires_at,
         request_count = EXCLUDED.request_count,
         last_request_at = EXCLUDED.last_request_at`,
      [email, otpHash, requestCount]
    );

    try {
      await sendBrevoEmail({ to: email, firstName: user.first_name, otp });
    } catch (emailError) {
      await pool.query("DELETE FROM otp_requests WHERE email = $1", [email]);
      if (emailError.message === "BREVO_RATE_LIMITED") {
        return { success: false, message: "Email service is busy. Please wait and try again." };
      }
      console.error("Email error:", emailError);
      return { success: false, message: "Failed to send verification code. Please try again." };
    }

    return { success: true, message: "Verification code sent to your email" };
  } catch (error) {
    console.error("sendOTP error:", error);
    return { success: false, message: "Failed to send verification code" };
  }
}

// ============================================================
// VERIFY OTP
// ============================================================
async function verifyOTP(email, code) {
  try {
    const otpCheck = await pool.query(
      `SELECT otp_hash, (expires_at < NOW()) AS is_expired
       FROM otp_requests WHERE email = $1`,
      [email]
    );

    if (otpCheck.rows.length === 0) {
      return { success: false, message: "No OTP found. Please request a new one." };
    }

    const otp = otpCheck.rows[0];

    if (otp.is_expired) {
      await pool.query("DELETE FROM otp_requests WHERE email = $1", [email]);
      return { success: false, message: "OTP expired. Please request a new one." };
    }

    const valid = await bcrypt.compare(code, otp.otp_hash);
    if (!valid) return { success: false, message: "Invalid OTP." };

    await pool.query("DELETE FROM otp_requests WHERE email = $1", [email]);
    return { success: true, message: "OTP verified." };
  } catch (error) {
    console.error("verifyOTP error:", error);
    return { success: false, message: "Verification failed." };
  }
}

async function resendOTP(email) {
  return sendOTP(email);
}

module.exports = { sendOTP, verifyOTP, resendOTP };
