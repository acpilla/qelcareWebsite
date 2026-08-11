const db = require("../../../config/database");

const DEFAULT_LIMIT = 50;

function sanitizeLimit(limit) {
  return Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), 100);
}

const Notification = {
  async create({
    user_id,
    type = "info",
    title,
    message,
    link = null,
    appointment_id = null,
    metadata = {},
  }) {
    if (!user_id || !title || !message) return null;

    const result = await db.query(
      `INSERT INTO notifications
        (user_id, type, title, message, link, appointment_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [
        user_id,
        String(type || "info").slice(0, 50),
        String(title).slice(0, 180),
        String(message),
        link || null,
        appointment_id || null,
        JSON.stringify(metadata || {}),
      ]
    );

    return result.rows[0];
  },

  async findForUser(userId, { unread_only = false, limit = DEFAULT_LIMIT } = {}) {
    const params = [userId, sanitizeLimit(limit)];
    const unreadSql = unread_only ? "AND is_read = false" : "";

    const result = await db.query(
      `SELECT
         id,
         user_id,
         type,
         title,
         message,
         link,
         appointment_id,
         is_read,
         metadata,
         -- created_at / read_at are 'timestamp without time zone' holding Manila
         -- wall-clock (inserted via NOW() under SET TIMEZONE='Asia/Manila').
         -- Interpret them AS Asia/Manila so the API returns a correct absolute
         -- instant (timestamptz) regardless of the server process timezone —
         -- the deployed backend runs in UTC, which would otherwise read the
         -- naive value as UTC and shift every timestamp +8h into the future.
         (created_at AT TIME ZONE 'Asia/Manila') AS created_at,
         (read_at    AT TIME ZONE 'Asia/Manila') AS read_at
       FROM notifications
       WHERE user_id = $1
       ${unreadSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      params
    );

    return result.rows;
  },

  async unreadCount(userId) {
    const result = await db.query(
      "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
      [userId]
    );
    return result.rows[0]?.count || 0;
  },

  async markRead({ id, user_id }) {
    const result = await db.query(
      `UPDATE notifications
       SET is_read = true,
           read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [id, user_id]
    );

    return result.rows[0] || null;
  },

  async markAllRead(userId) {
    const result = await db.query(
      `UPDATE notifications
       SET is_read = true,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
         AND is_read = false
       RETURNING id`,
      [userId]
    );

    return result.rowCount;
  },
};

module.exports = Notification;
