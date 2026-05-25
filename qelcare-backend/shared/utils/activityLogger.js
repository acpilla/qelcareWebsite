// ============================================================
// FILE: qelcare-backend/shared/utils/activityLogger.js
// ============================================================
const pool = require('../../config/database');

const log = async ({
  userId      = null,
  action,
  entityType  = null,
  entityId    = null,
  description = null,
  ip          = null,
  metadata    = null,
} = {}) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs
         (user_id, action, entity_type, entity_id, description, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
      [
        userId     || null,
        action,
        entityType || null,
        entityId   || null,
        description|| null,
        ip         || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[ActivityLogger] Failed to write log:', err.message);
  }
};

const getIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
};

module.exports = { log, getIP };