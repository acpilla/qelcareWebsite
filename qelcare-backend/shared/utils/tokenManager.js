const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

// ============================================================
// CREATE TOKEN — saves to active_tokens table
// ============================================================
const createToken = async (payload, options = {}) => {
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || "24h";
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  await pool.query(
    `INSERT INTO active_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [payload.user_id, token, expiresAt]
  );

  return token;
};

// ============================================================
// VERIFY TOKEN — checks JWT signature + DB existence
// ============================================================
const verifyToken = async (token) => {
  // 1. Verify JWT signature
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 2. Check if token exists in DB (not revoked)
  const result = await pool.query(
    `SELECT token_id FROM active_tokens
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    const err = new Error("Token has been revoked or expired. Please login again.");
    err.name = "TokenRevokedError";
    throw err;
  }

  return decoded;
};

// ============================================================
// REVOKE SINGLE TOKEN
// ============================================================
const revokeToken = async (token) => {
  await pool.query("DELETE FROM active_tokens WHERE token = $1", [token]);
};

// ============================================================
// REVOKE ALL TOKENS FOR USER (logout all devices)
// ============================================================
const revokeAllUserTokens = async (userId) => {
  await pool.query("DELETE FROM active_tokens WHERE user_id = $1", [userId]);
};

// ============================================================
// CLEANUP EXPIRED TOKENS (run on schedule)
// ============================================================
const cleanupExpiredTokens = async () => {
  const result = await pool.query(
    "DELETE FROM active_tokens WHERE expires_at < NOW()"
  );
  console.log(`🧹 Cleaned ${result.rowCount} expired tokens`);
};

module.exports = {
  createToken,
  verifyToken,
  revokeToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
};
