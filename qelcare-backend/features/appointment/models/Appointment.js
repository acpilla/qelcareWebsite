const db = require("../../../config/database");

const VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"];
const VALID_TYPES = ["consultation", "follow_up", "walk_in", "emergency"];

const ACTIVE_CONFLICT_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "COMPLETED"];

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeType(type) {
  const value = String(type || "consultation").trim().toLowerCase();
  return VALID_TYPES.includes(value) ? value : "consultation";
}

async function assertNoDoctorConflict({ doctor_id, date, time, excludeId = null }) {
  const params = [doctor_id, date, time, ACTIVE_CONFLICT_STATUSES];
  let exclude = "";
  if (excludeId) {
    params.push(excludeId);
    exclude = `AND id <> $${params.length}`;
  }

  const conflict = await db.query(
    `SELECT id
     FROM appointments
     WHERE doctor_id = $1
       AND date = $2
       AND time = $3
       AND status = ANY($4)
       ${exclude}
     LIMIT 1`,
    params
  );

  if (conflict.rowCount > 0) {
    throw { statusCode: 409, message: "Doctor already has an active appointment at this time." };
  }
}

const Appointment = {
  async create({
    patient_id,
    doctor_id,
    specialty_id,
    date,
    time,
    type,
    chief_complaint,
    notes,
    booked_by,
  }) {
    await assertNoDoctorConflict({ doctor_id, date, time });

    const result = await db.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, specialty_id, date, time, type, chief_complaint, notes, booked_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
       RETURNING *`,
      [
        patient_id,
        doctor_id,
        specialty_id || null,
        date,
        time,
        normalizeType(type),
        chief_complaint || null,
        notes || null,
        booked_by || null,
      ]
    );

    return this.findById(result.rows[0].id);
  },

  async findAll({
    role,
    userId,
    status,
    date,
    date_from,
    date_to,
    specialty_id,
    doctor_id,
    patient_id,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const params = [];
    const conditions = [];

    if (role === "Doctor") {
      params.push(userId);
      conditions.push(`a.doctor_id = $${params.length}`);
    } else if (role === "Patient") {
      params.push(userId);
      conditions.push(`p.user_id = $${params.length}`);
    }

    if (status) {
      params.push(normalizeStatus(status));
      conditions.push(`a.status = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`a.date = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`a.date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`a.date <= $${params.length}`);
    }
    if (specialty_id) {
      params.push(specialty_id);
      conditions.push(`a.specialty_id = $${params.length}`);
    }
    if (doctor_id) {
      params.push(doctor_id);
      conditions.push(`a.doctor_id = $${params.length}`);
    }
    if (patient_id) {
      params.push(patient_id);
      conditions.push(`a.patient_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        p.name ILIKE $${params.length} OR
        p.first_name ILIKE $${params.length} OR
        p.last_name ILIKE $${params.length} OR
        p.phone ILIKE $${params.length} OR
        u.first_name ILIKE $${params.length} OR
        u.last_name ILIKE $${params.length} OR
        CAST(a.id AS TEXT) ILIKE $${params.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const dataParams = [...params, safeLimit, offset];

    const selectSql = `
      SELECT
        a.*,
        a.time::text AS time,
        TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
        p.phone AS patient_phone,
        p.email AS patient_email,
        p.gender AS patient_gender,
        p.date_of_birth,
        u.first_name AS doctor_first_name,
        u.last_name AS doctor_last_name,
        TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS doctor_name,
        u.email AS doctor_email,
        s.specialty_name,
        s.slug AS specialty_slug,
        latest_mr.record_id AS latest_record_id,
        latest_mr.diagnosis AS latest_diagnosis,
        latest_mr.lab_requests AS requested_services,
        latest_mr.lab_requests AS lab_requests
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.user_id
      LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
      LEFT JOIN LATERAL (
        SELECT mr.record_id, mr.diagnosis, mr.lab_requests, mr.visit_date, mr.created_at
        FROM medical_records mr
        WHERE mr.appointment_id = a.id
        ORDER BY COALESCE(mr.visit_date, mr.created_at::date) DESC, mr.record_id DESC
        LIMIT 1
      ) latest_mr ON true
      ${where}
      ORDER BY
        CASE
          WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') THEN 0
          ELSE 1
        END ASC,
        CASE a.status
          WHEN 'IN_QUEUE' THEN 0
          WHEN 'CONFIRMED' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'RESCHEDULED' THEN 3
          WHEN 'COMPLETED' THEN 4
          WHEN 'CANCELLED' THEN 5
          WHEN 'NO_SHOW' THEN 6
          ELSE 9
        END ASC,
        CASE WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') THEN a.date END ASC NULLS LAST,
        CASE WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') THEN a.time END ASC NULLS LAST,
        CASE WHEN a.status NOT IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') THEN a.date END DESC NULLS LAST,
        CASE WHEN a.status NOT IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') THEN a.time END DESC NULLS LAST,
        a.id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.user_id
      LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
      ${where}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(selectSql, dataParams),
      db.query(countSql, params),
    ]);

    const total = countResult.rows[0]?.count || 0;
    return {
      data: dataResult.rows,
      appointments: dataResult.rows,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  },

  async findById(id) {
    const result = await db.query(
      `SELECT
         a.*,
         a.time::text AS time,
         TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
         p.phone AS patient_phone,
         p.email AS patient_email,
         p.date_of_birth,
         p.gender AS patient_gender,
         TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS doctor_name,
         u.email AS doctor_email,
         s.specialty_name,
         s.slug AS specialty_slug,
         latest_mr.record_id AS latest_record_id,
         latest_mr.diagnosis AS latest_diagnosis,
         latest_mr.lab_requests AS requested_services,
         latest_mr.lab_requests AS lab_requests
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.user_id
       LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
       LEFT JOIN LATERAL (
         SELECT mr.record_id, mr.diagnosis, mr.lab_requests, mr.visit_date, mr.created_at
         FROM medical_records mr
         WHERE mr.appointment_id = a.id
         ORDER BY COALESCE(mr.visit_date, mr.created_at::date) DESC, mr.record_id DESC
         LIMIT 1
       ) latest_mr ON true
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getRawById(id) {
    const result = await db.query("SELECT * FROM appointments WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async updateStatus(id, status, { cancelled_by = null, cancel_reason = null } = {}) {
    const nextStatus = normalizeStatus(status);
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw { statusCode: 400, message: `Invalid status. Use: ${VALID_STATUSES.join(", ")}` };
    }

    const result = await db.query(
      `UPDATE appointments
       SET status = $1::varchar,
           cancelled_by = CASE WHEN $1::varchar = 'CANCELLED' THEN $2::integer ELSE cancelled_by END,
           cancel_reason = CASE WHEN $1::varchar = 'CANCELLED' THEN $3::text ELSE cancel_reason END,
           updated_at = NOW()
       WHERE id = $4::integer
       RETURNING id`,
      [nextStatus, cancelled_by, cancel_reason || null, id]
    );

    if (!result.rows[0]) return null;
    return this.findById(result.rows[0].id);
  },

  async reschedule(id, { date, time }) {
    if (!date || !time) {
      throw { statusCode: 400, message: "New date and time are required." };
    }

    const current = await this.getRawById(id);
    if (!current) throw { statusCode: 404, message: "Appointment not found." };
    if (["COMPLETED", "CANCELLED", "NO_SHOW", "IN_QUEUE"].includes(current.status)) {
      throw { statusCode: 400, message: `Cannot reschedule an appointment with status ${current.status}.` };
    }

    await assertNoDoctorConflict({
      doctor_id: current.doctor_id,
      date,
      time,
      excludeId: id,
    });

    const nextNotes = current.notes
      ? `${current.notes}\nRescheduled from ${current.date} ${current.time}.`
      : `Rescheduled from ${current.date} ${current.time}.`;

    const result = await db.query(
      `UPDATE appointments
       SET date = $1,
           time = $2,
           status = 'PENDING',
           notes = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [date, time, nextNotes, id]
    );

    return this.findById(result.rows[0].id);
  },

  async getTodayByDoctor(doctorId) {
    const result = await db.query(
      `SELECT
         a.*,
         a.time::text AS time,
         TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
         p.phone AS patient_phone,
         TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS doctor_name,
         s.specialty_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.user_id
       LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
       WHERE a.doctor_id = $1
         AND a.date = (NOW() AT TIME ZONE 'Asia/Manila')::date
         AND a.status NOT IN ('CANCELLED','NO_SHOW')
       ORDER BY a.time ASC`,
      [doctorId]
    );
    return result.rows;
  },
};

Appointment.VALID_STATUSES = VALID_STATUSES;
Appointment.VALID_TYPES = VALID_TYPES;

module.exports = Appointment;
