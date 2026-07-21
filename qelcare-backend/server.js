const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const tokenManager = require("./shared/utils/tokenManager");
const Appointment = require("./features/appointment/models/Appointment");

const app = express();

// Security headers. crossOriginResourcePolicy is relaxed so cross-origin images
// (Cloudinary, backend-served profile pictures) keep loading in the browser.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// ── Rate limiters ─────────────────────────────────────────────
// IP-based throttles on the auth surface, layered on top of the per-email OTP
// cooldown and the per-account login lockout already enforced in the DB layer.
const rateLimitOptions = { standardHeaders: true, legacyHeaders: false };

// General auth traffic (registration, verification, token ops).
const authLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: "Too many requests. Please try again later." },
});

// Tighter limit for credential and OTP endpoints (brute-force / spam defence).
const loginLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
});

const otpLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: { success: false, message: "Too many verification requests. Please wait and try again." },
});

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5002",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  "http://192.168.1.155:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
require("./config/database");

// Throttle the sensitive auth endpoints (must be registered before the routers).
app.use("/auth/login", loginLimiter);
app.use("/auth/otp", otpLimiter);
app.use("/auth/password", loginLimiter);
app.use("/auth/patient", authLimiter);

app.use("/auth/patient", require("./features/auth/routes/patientRegistrationRoutes"));
app.use("/auth", require("./features/auth/routes/authRoutes"));
app.use("/users", require("./features/user/routes/userRoutes"));
app.use("/patients", require("./features/patient/routes/patientRoutes"));
app.use("/appointments", require("./features/appointment/routes/appointmentRoutes"));
app.use("/notifications", require("./features/notification/routes/notificationRoutes"));
app.use("/medical-records", require("./features/records/routes/recordRoutes"));
app.use("/patient-results", require("./features/patientResults/routes/patientResultRoutes"));
app.use("/medications", require("./features/medication/routes/medicationRoutes"));
app.use("/vitals", require("./features/vitals/routes/vitalRoutes"));
app.use("/billing", require("./features/billing/routes/billingRoutes"));
app.use("/queue", require("./features/queue/routes/queueRoutes"));
const analyticsRoutes = require("./features/analytics/routes/analyticsRoutes");
app.use("/analytics", analyticsRoutes);
app.use("/activity-logs", require("./features/auth/routes/activityLogRoutes"));
app.use("/inquiries", require("./features/inquiry/routes/inquiryRoutes"));
app.use("/relatives", require("./features/relative/routes/relativeRoutes"));

app.get("/", (_req, res) => res.json({ message: "QELCare Backend is running." }));
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((req, res) => res.status(404).json({ message: "Route not found." }));
app.use((err, _req, res, _next) => {
  console.error("Server error:", err.message);
  res.status(err.status || 500).json({ message: "Internal server error." });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`QELCare backend running on http://localhost:${PORT}`));

setInterval(async () => {
  try {
    await tokenManager.cleanupExpiredTokens();
  } catch (err) {
    console.error("Token cleanup error:", err.message);
  }
}, 60 * 60 * 1000);

// Auto-settle past, unresolved appointments so none sit stuck as PENDING.
// Runs shortly after boot, then hourly. Grace period = 120 min after the slot.
async function runAppointmentSweep() {
  try {
    const result = await Appointment.autoSettlePastAppointments({ graceMinutes: 120 });
    if (result.settled > 0) {
      console.log(`Appointment sweep: settled ${result.settled} past appointment(s) to NO_SHOW.`);
    }
  } catch (err) {
    console.error("Appointment sweep error:", err.message);
  }
}

setTimeout(runAppointmentSweep, 15 * 1000);
setInterval(runAppointmentSweep, 60 * 60 * 1000);

// Warm up the local Ollama model after boot so the first AI report doesn't
// pay the cold-start delay (which previously caused timeouts -> fallback).
if (typeof analyticsRoutes.warmupOllama === "function") {
  setTimeout(() => analyticsRoutes.warmupOllama(), 5 * 1000);
}
