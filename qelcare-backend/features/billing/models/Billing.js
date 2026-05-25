// ============================================================
// FILE: qelcare-backend/features/billing/models/Billing.js
// ============================================================
const db = require('../../../config/database');

const Billing = {

  async create({ appointment_id, patient_id, cashier_id, line_items, discount_type, discount_pct, payment_method, amount_tendered, notes }) {
    const items       = line_items || [];
    const subtotal    = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const discPct     = parseFloat(discount_pct || 0);
    const discAmount  = parseFloat((subtotal * discPct / 100).toFixed(2));
    const total       = parseFloat((subtotal - discAmount).toFixed(2));
    const change      = amount_tendered ? parseFloat((parseFloat(amount_tendered) - total).toFixed(2)) : null;
    const orNumber    = await db.query(`SELECT generate_or_number() AS or_num`).then(r => r.rows[0].or_num);

    const result = await db.query(
      `INSERT INTO billing
         (appointment_id, patient_id, cashier_id, line_items,
          discount_type, discount_pct, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          or_number, status, paid_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PAID',NOW(),$13)
       RETURNING *`,
      [
        appointment_id, patient_id, cashier_id || null,
        JSON.stringify(items),
        discount_type || 'none', discPct, discAmount,
        total, payment_method || 'cash',
        amount_tendered || null, change,
        orNumber, notes || null,
      ]
    );
    return result.rows[0];
  },

  async findAll({ search = '', status, page = 1, limit = 20 } = {}) {
    const offset     = (page - 1) * limit;
    const params     = [`%${search}%`];
    const conditions = [`(COALESCE(CONCAT(p.first_name,' ',p.last_name), p.name) ILIKE $1 OR b.or_number ILIKE $1)`];

    if (status) {
      params.push(status.toUpperCase());
      conditions.push(`b.status = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT
           b.*,
           COALESCE(CONCAT(p.first_name,' ',p.last_name), p.name) AS patient_name,
           p.philhealth_no,
           CONCAT(u.first_name,' ',u.last_name) AS cashier_name,
           a.date AS appointment_date, a.time AS appointment_time,
           CONCAT(d.first_name,' ',d.last_name) AS doctor_name
         FROM billing b
         JOIN patients p     ON b.patient_id     = p.id
         LEFT JOIN users u   ON b.cashier_id     = u.user_id
         LEFT JOIN appointments a ON b.appointment_id = a.id
         LEFT JOIN users d   ON a.doctor_id      = d.user_id
         ${where}
         ORDER BY b.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      db.query(
        `SELECT COUNT(*) FROM billing b
         JOIN patients p ON b.patient_id = p.id
         ${where}`,
        [`%${search}%`, ...(status ? [status.toUpperCase()] : [])]
      ),
    ]);

    return {
      data:  dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page, limit,
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    };
  },

  async findById(id) {
    const result = await db.query(
      `SELECT
         b.*,
         COALESCE(CONCAT(p.first_name,' ',p.last_name), p.name) AS patient_name,
         p.philhealth_no, p.senior_pwd_id, p.date_of_birth, p.gender AS patient_gender,
         CONCAT(u.first_name,' ',u.last_name) AS cashier_name,
         a.date AS appointment_date, a.time AS appointment_time,
         CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
         s.specialty_name
       FROM billing b
       JOIN patients p          ON b.patient_id     = p.id
       LEFT JOIN users u        ON b.cashier_id     = u.user_id
       LEFT JOIN appointments a ON b.appointment_id = a.id
       LEFT JOIN users d        ON a.doctor_id      = d.user_id
       LEFT JOIN specialties s  ON a.specialty_id   = s.specialty_id
       WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByAppointment(appointmentId) {
    const result = await db.query(
      `SELECT b.* FROM billing b WHERE b.appointment_id = $1 ORDER BY b.created_at DESC LIMIT 1`,
      [appointmentId]
    );
    return result.rows[0] || null;
  },

  async void(id, cashier_id) {
    const result = await db.query(
      `UPDATE billing
       SET status = 'VOIDED', cashier_id = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'PAID'
       RETURNING *`,
      [cashier_id, id]
    );
    return result.rows[0] || null;
  },

  async getDashboardStats() {
    const result = await db.query(
      `SELECT
         COUNT(*)                                        AS total_transactions,
         COUNT(*) FILTER (WHERE status = 'PAID')        AS paid_count,
         COUNT(*) FILTER (WHERE status = 'VOIDED')      AS voided_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0)   AS total_revenue,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'
           AND DATE(paid_at) = CURRENT_DATE), 0)        AS today_revenue,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'
           AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())), 0) AS month_revenue
       FROM billing`
    );
    return result.rows[0];
  },

  async getRecentTransactions(limit = 10) {
    const result = await db.query(
      `SELECT
         b.id, b.or_number, b.total_amount, b.payment_method,
         b.status, b.paid_at,
         COALESCE(CONCAT(p.first_name,' ',p.last_name), p.name) AS patient_name
       FROM billing b
       JOIN patients p ON b.patient_id = p.id
       WHERE b.status = 'PAID'
       ORDER BY b.paid_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },
};

module.exports = Billing;