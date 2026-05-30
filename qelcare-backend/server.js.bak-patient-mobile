const express = require("express");
const cors = require("cors");
require("dotenv").config();

const tokenManager = require("./shared/utils/tokenManager");

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5002",
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

app.use("/auth", require("./features/auth/routes/authRoutes"));
app.use("/users", require("./features/user/routes/userRoutes"));
app.use("/patients", require("./features/patient/routes/patientRoutes"));
app.use("/appointments", require("./features/appointment/routes/appointmentRoutes"));
app.use("/medical-records", require("./features/records/routes/recordRoutes"));
app.use("/patient-results", require("./features/patientResults/routes/patientResultRoutes"));
app.use("/vitals", require("./features/vitals/routes/vitalRoutes"));
app.use("/billing", require("./features/billing/routes/billingRoutes"));
app.use("/queue", require("./features/queue/routes/queueRoutes"));
app.use("/analytics", require("./features/analytics/routes/analyticsRoutes"));
app.use("/activity-logs", require("./features/auth/routes/activityLogRoutes"));

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