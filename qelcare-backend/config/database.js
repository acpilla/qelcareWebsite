const { Pool } = require("pg");
require("dotenv").config();

const REQUIRED_ENV = ["DB_USER", "DB_PASS", "DB_HOST", "DB_PORT", "DB_NAME"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const sslConfig = { rejectUnauthorized: false };

const pool = new Pool({
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  ssl:      sslConfig,
  max:      10,
  min:      0,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis:  5_000,
});

pool.on("connect", async (client) => {
  try {
    await client.query("SET TIMEZONE = 'Asia/Manila'");
  } catch (err) {
    console.error("⚠️ DB client config error:", err.message);
  }
});

pool.on("error", (err) => {
  console.error("❌ DB pool error:", err.message);
});

const shutdown = async (signal) => {
  console.log(`${signal} — closing DB pool...`);
  await pool.end();
  process.exit(0);
};
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = pool;
