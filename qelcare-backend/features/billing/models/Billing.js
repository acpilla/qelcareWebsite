const db = require("../../../config/database");

const VALID_PAYMENT_METHODS = ["cash", "gcash", "maya", "card", "philhealth", "hmo"];
const VALID_DISCOUNT_TYPES = ["none", "senior", "pwd", "philhealth", "hmo", "other"];

function toMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Number(Math.max(0, number).toFixed(2));
}

function normalizeLineItems(lineItems = []) {
  return lineItems
    .map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = item.unit_price !== undefined ? toMoney(item.unit_price) : toMoney(item.amount);
      const amount = item.amount !== undefined ? toMoney(item.amount) : toMoney(quantity * unitPrice);
      return {
        description: String(item.description || "Clinic service").trim() || "Clinic service",
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit_price: unitPrice,
        amount,
      };
    })
    .filter((item) => item.amount > 0);
}

function normalizePaymentMethod(method) {
  const value = String(method || "cash").trim().toLowerCase();
  return VALID_PAYMENT_METHODS.includes(value) ? value : "cash";
}

function normalizeDiscountType(type) {
  const value = String(type || "none").trim().toLowerCase();
  return VALID_DISCOUNT_TYPES.includes(value) ? value : "none";
}

async function nextOrNumber() {
  const result = await db.query("SELECT generate_or_number() AS or_num");
  return result.rows[0].or_num;
}

const Billing = {
  async create({
    appointment_id,
    patient_id,
    cashier_id,
    line_items,
    discount_type,
    discount_pct,
    payment_method,
    amount_tendered,
    notes,
  }) {
    const items = normalizeLineItems(line_items);
    if (!items.length) {
      const err = new Error("At least one billable item with amount greater than zero is required.");
      err.statusCode = 400;
      throw err;
    }

    const subtotal = toMoney(items.reduce((sum, item) => sum + item.amount, 0));
    const discPct = Math.min(100, toMoney(discount_pct));
    const discAmount = toMoney(subtotal * (discPct / 100));
    const total = toMoney(subtotal - discAmount);
    const tendered = amount_tendered === undefined || amount_tendered === null ? total : toMoney(amount_tendered);

    if (tendered < total) {
      const err = new Error("Amount tendered must be equal to or greater than the total.");
      err.statusCode = 400;
      throw err;
    }

    const change = toMoney(tendered - total);
    const orNumber = await nextOrNumber();

    const result = await db.query(
      `INSERT INTO billing
       (appointment_id, patient_id, cashier_id, line_items,
        discount_type, discount_pct, discount_amount,
        subtotal, total_amount, payment_method, amount_tendered, change_amount,
        or_number, status, paid_at, notes)
       VALUES ($1::integer,$2::integer,$3::integer,$4::jsonb,
        $5::varchar,$6::numeric,$7::numeric,
        $8::numeric,$9::numeric,$10::varchar,$11::numeric,$12::numeric,
        $13::varchar,'PAID',NOW(),$14::text)
       RETURNING *`,
      [
        appointment_id,
        patient_id,
        cashier_id || null,
        JSON.stringify(items),
        normalizeDiscountType(discount_type),
        discPct,
        discAmount,
        subtotal,
        total,
        normalizePaymentMethod(payment_method),
        tendered,
        change,
        orNumber,
        notes || null,
      ]
    );

    return result.rows[0];
  },

  async findAll({ search = "", status, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) ILIKE $${params.length}
        OR b.or_number ILIKE $${params.length}
        OR CAST(b.id AS TEXT) ILIKE $${params.length}
      )`);
    }

    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`b.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const dataParams = [...params, safeLimit, offset];

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT
           b.*,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
           p.philhealth_no,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username) AS cashier_name,
           TO_CHAR(a.date, 'YYYY-MM-DD') AS appointment_date,
           a.time::text AS appointment_time,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)), ''), d.username) AS doctor_name,
           s.specialty_name
         FROM billing b
         JOIN patients p ON b.patient_id = p.id
         LEFT JOIN users u ON b.cashier_id = u.user_id
         LEFT JOIN appointments a ON b.appointment_id = a.id
         LEFT JOIN users d ON a.doctor_id = d.user_id
         LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
         ${where}
         ORDER BY b.created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM billing b
         JOIN patients p ON b.patient_id = p.id
         ${where}`,
        params
      ),
    ]);

    const total = countResult.rows[0]?.count || 0;
    return {
      data: dataResult.rows,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  },

  async findById(id) {
    const result = await db.query(
      `SELECT
         b.*,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
         p.philhealth_no,
         p.senior_pwd_id,
         p.date_of_birth,
         p.gender AS patient_gender,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username) AS cashier_name,
         TO_CHAR(a.date, 'YYYY-MM-DD') AS appointment_date,
         a.time::text AS appointment_time,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)), ''), d.username) AS doctor_name,
         s.specialty_name
       FROM billing b
       JOIN patients p ON b.patient_id = p.id
       LEFT JOIN users u ON b.cashier_id = u.user_id
       LEFT JOIN appointments a ON b.appointment_id = a.id
       LEFT JOIN users d ON a.doctor_id = d.user_id
       LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
       WHERE b.id = $1::integer`,
      [id]
    );

    return result.rows[0] || null;
  },

  async findByAppointment(appointmentId) {
    const result = await db.query(
      `SELECT *
       FROM billing
       WHERE appointment_id = $1::integer
       ORDER BY created_at DESC
       LIMIT 1`,
      [appointmentId]
    );

    return result.rows[0] || null;
  },

  async void(id, cashier_id) {
    const result = await db.query(
      `UPDATE billing
       SET status = 'VOIDED',
           cashier_id = $1::integer,
           voided_by = $1::integer,
           voided_at = NOW(),
           updated_at = NOW()
       WHERE id = $2::integer
         AND status = 'PAID'
       RETURNING *`,
      [cashier_id, id]
    );

    return result.rows[0] || null;
  },

  async getDashboardStats() {
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS total_transactions,
         COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid_count,
         COUNT(*) FILTER (WHERE status = 'VOIDED')::int AS voided_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0) AS total_revenue,
         COALESCE(SUM(total_amount) FILTER (
           WHERE status = 'PAID'
             AND (paid_at AT TIME ZONE 'Asia/Manila')::date = (NOW() AT TIME ZONE 'Asia/Manila')::date
         ), 0) AS today_revenue,
         COALESCE(SUM(total_amount) FILTER (
           WHERE status = 'PAID'
             AND DATE_TRUNC('month', paid_at AT TIME ZONE 'Asia/Manila') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila')
         ), 0) AS month_revenue
       FROM billing`
    );

    return result.rows[0];
  },

  async getRecentTransactions(limit = 10) {
    const result = await db.query(
      `SELECT
         b.id,
         b.or_number,
         b.subtotal,
         b.discount_amount,
         b.total_amount,
         b.payment_method,
         b.status,
         b.paid_at,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name
       FROM billing b
       JOIN patients p ON b.patient_id = p.id
       WHERE b.status = 'PAID'
       ORDER BY b.paid_at DESC
       LIMIT $1::integer`,
      [limit]
    );

    return result.rows;
  },
};

module.exports = Billing;
