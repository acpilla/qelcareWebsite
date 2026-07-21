// ============================================================================
// QELCare unified email layer
// ----------------------------------------------------------------------------
// WHAT:  Single source of truth for ALL outbound email (OTP codes + appointment
//        notifications). Uses Brevo's transactional API over Node's built-in
//        `https` module (no global fetch dependency, works on any Node >= 12).
//
// WHY:   Previously two separate code paths existed (authService used global
//        fetch; emailNotifier used https). They drifted apart and one could
//        fail silently. This consolidates them.
//
// DEV FALLBACK: If Brevo is not configured, OTP emails are printed to the
//        server console (clearly boxed) so local development never gets stuck
//        on a missing verification code. Controlled by EMAIL_DEV_FALLBACK.
//
// ENV (see .env.example):
//   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
//   EMAIL_DEV_FALLBACK = "true" | "false"  (default: true when NODE_ENV != production)
// ============================================================================

const https = require("https");

const BREVO_HOST = "api.brevo.com";
const BREVO_PATH = "/v3/smtp/email";
const REQUEST_TIMEOUT_MS = 10000;

const OTP_TTL_MINUTES_DEFAULT = 2;

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------
function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

function devFallbackEnabled() {
  if (typeof process.env.EMAIL_DEV_FALLBACK === "string") {
    return process.env.EMAIL_DEV_FALLBACK.toLowerCase() === "true";
  }
  // Default ON unless explicitly in production.
  return process.env.NODE_ENV !== "production";
}

function sender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || "QELCare System",
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Low-level Brevo request
// ---------------------------------------------------------------------------
function requestBrevo(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: BREVO_HOST,
        path: BREVO_PATH,
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Accept: "application/json",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode, data });
          } else {
            const err = new Error(`Brevo returned ${res.statusCode}: ${data}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("Brevo request timed out.")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Generic email send
//   Returns: { ok: bool, skipped?: bool, dev?: bool, reason?, rateLimited?: bool }
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, htmlContent, textContent }) {
  if (!to) {
    return { ok: false, skipped: true, reason: "Missing recipient email." };
  }

  if (!isBrevoConfigured()) {
    if (devFallbackEnabled()) {
      console.log(
        "\n[QELCare EMAIL — DEV FALLBACK] Brevo not configured. Email NOT sent.\n" +
          `  To:      ${to}\n` +
          `  Subject: ${subject}\n` +
          (textContent ? `  Text:    ${textContent}\n` : "")
      );
      return { ok: true, dev: true };
    }
    console.log("Brevo email skipped: BREVO_API_KEY or BREVO_SENDER_EMAIL not configured.");
    return { ok: false, skipped: true, reason: "Email service is not configured." };
  }

  try {
    await requestBrevo({
      sender: sender(),
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    });
    return { ok: true };
  } catch (err) {
    const rateLimited = err.statusCode === 429;
    console.error("Brevo email error:", err.message);
    return { ok: false, skipped: false, reason: err.message, rateLimited };
  }
}

// ---------------------------------------------------------------------------
// OTP email
//   Always logs the code to console in dev fallback so it is never lost.
// ---------------------------------------------------------------------------
function otpHtml({ firstName, otp, ttlMinutes }) {
  const safeName = escapeHtml(firstName || "User");
  const safeOtp = escapeHtml(otp);
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;background:#f5f8fc;padding:20px;">
        <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #dbe6f3;">
          <div style="background:#0f766e;color:#fff;padding:24px;text-align:center;">
            <h1 style="margin:0;font-size:26px;">QELCare</h1>
            <p style="margin:6px 0 0;">Clinic Management System</p>
          </div>
          <div style="padding:26px;">
            <p>Hello ${safeName},</p>
            <p>Use this verification code to continue:</p>
            <div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#0f766e;text-align:center;border:2px solid #0f766e;border-radius:12px;padding:16px;margin:20px 0;">${safeOtp}</div>
            <p>This code expires in <strong>${ttlMinutes} minutes</strong>.</p>
            <p style="font-size:12px;color:#718096;">If you did not request this, ignore this email or contact the clinic.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function logOtpToConsole({ to, subject, otp, minutes, note }) {
  const line = "=".repeat(54);
  console.log(
    `\n${line}\n` +
      `  QELCare OTP (DEV FALLBACK — ${note})\n` +
      `  To:      ${to}\n` +
      `  Subject: ${subject || "QELCare Verification Code"}\n` +
      `  CODE:    ${otp}   (expires in ${minutes} min)\n` +
      `${line}\n`
  );
}

async function sendOtpEmail({ to, firstName, otp, subject, ttlMinutes }) {
  const minutes = ttlMinutes || OTP_TTL_MINUTES_DEFAULT;
  const devOn = devFallbackEnabled();

  // Case 1: Brevo not configured at all -> straight to console (dev only).
  if (!isBrevoConfigured()) {
    if (devOn) {
      logOtpToConsole({ to, subject, otp, minutes, note: "Brevo not configured" });
      return { ok: true, dev: true };
    }
    return { ok: false, skipped: true, reason: "Email service is not configured." };
  }

  // Case 2: Brevo IS configured -> attempt a real send.
  const result = await sendEmail({
    to,
    subject: subject || "QELCare - Your Verification Code",
    htmlContent: otpHtml({ firstName, otp, ttlMinutes: minutes }),
    textContent: `Your QELCare verification code is ${otp}. It expires in ${minutes} minutes.`,
  });

  if (result.ok) return result;

  // Case 3: real send FAILED (e.g. Brevo 401 IP block). In dev, don't block the
  // developer — print the code to the console. In production, propagate failure
  // so registration rolls back and no account is stranded.
  if (devOn) {
    logOtpToConsole({
      to,
      subject,
      otp,
      minutes,
      note: `Brevo send failed (${result.reason || "unknown"}) — using console`,
    });
    return { ok: true, dev: true };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Appointment notification (kept here so all email lives in one module)
// ---------------------------------------------------------------------------
async function sendAppointmentNotification({
  to,
  patientName,
  doctorName,
  specialtyName,
  date,
  time,
  status = "PENDING",
}) {
  const subject = `QELCare appointment ${String(status).toLowerCase()}`;
  const safePatient = escapeHtml(patientName || "Patient");
  const safeDoctor = escapeHtml(doctorName || "your doctor");
  const safeSpecialty = escapeHtml(specialtyName || "Consultation");
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safeStatus = escapeHtml(status);
  const textContent = `Hello ${patientName || "Patient"}, your QELCare appointment is ${status}: ${specialtyName || "Consultation"} with ${doctorName || "your doctor"} on ${date} at ${time}.`;

  return sendEmail({
    to,
    subject,
    textContent,
    htmlContent: `
      <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5">
        <h2 style="margin:0 0 12px;color:#163a6b">QELCare Appointment Update</h2>
        <p>Hello ${safePatient},</p>
        <p>Your appointment is now <strong>${safeStatus}</strong>.</p>
        <table style="border-collapse:collapse;margin-top:12px">
          <tr><td style="padding:4px 12px 4px 0;color:#66778a">Service</td><td style="padding:4px 0">${safeSpecialty}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#66778a">Doctor</td><td style="padding:4px 0">${safeDoctor}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#66778a">Date</td><td style="padding:4px 0">${safeDate}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#66778a">Time</td><td style="padding:4px 0">${safeTime}</td></tr>
        </table>
      </div>
    `,
  });
}

module.exports = {
  isBrevoConfigured,
  devFallbackEnabled,
  sendEmail,
  sendOtpEmail,
  sendAppointmentNotification,
  escapeHtml,
};