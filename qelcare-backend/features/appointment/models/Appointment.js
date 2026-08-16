const db = require("../../../config/database");

const VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "FOR_BILLING", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"];
const VALID_TYPES = ["consultation", "follow_up", "walk_in", "emergency"];
const VALID_BOOKED_FOR = ["self", "other"];
const ACTIVE_CONFLICT_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "FOR_BILLING", "COMPLETED"];
const ACTIVE_VISIBLE_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "FOR_BILLING", "RESCHEDULED"];
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"];

// Anti-spam: after a patient CANCELS, they must wait this many seconds before
// they can book or cancel again. Cancelling is the churn signal, so this stops
// rapid book<->cancel spam while leaving legitimate multi-booking and undoing a
// fresh mistake (a first cancel) unaffected. Tunable here in one place.
const PATIENT_ACTION_COOLDOWN_SECONDS = 120;

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeType(type) {
  const value = String(type || "consultation").trim().toLowerCase();
  return VALID_TYPES.includes(value) ? value : "consultation";
}

function normalizeBookedFor(value) {
  const normalized = String(value || "self").trim().toLowerCase();
  return VALID_BOOKED_FOR.includes(normalized) ? normalized : "self";
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function manilaNowMinuteKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function appointmentMinuteKey(date, time) {
  const dateText = String(date || "").slice(0, 10);
  const timeText = normalizeTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) return "";
  return `${dateText}T${timeText}`;
}

function isPastManila(date, time) {
  const key = appointmentMinuteKey(date, time);
  if (!key) return false;
  return key <= manilaNowMinuteKey();
}

function assertNotPastManila(date, time, label = "Appointment schedule") {
  if (!appointmentMinuteKey(date, time)) {
    throw { statusCode: 400, message: "Valid date and time are required." };
  }
  if (isPastManila(date, time)) {
    throw { statusCode: 400, message: `${label} must be in the future using Asia/Manila time.` };
  }
}

// Clinic operating hours: 8:00 AM to 8:00 PM (Asia/Manila). Patient bookings and
// patient edits must fall inside this window.
const CLINIC_OPEN_MINUTES = 8 * 60;   // 08:00
const CLINIC_CLOSE_MINUTES = 20 * 60; // 20:00

function assertWithinClinicHours(time) {
  const t = normalizeTime(time);
  if (!/^\d{2}:\d{2}$/.test(t)) {
    throw { statusCode: 400, message: "Valid time is required." };
  }
  const [hour, minute] = t.split(":").map(Number);
  const total = hour * 60 + minute;
  if (total < CLINIC_OPEN_MINUTES || total > CLINIC_CLOSE_MINUTES) {
    throw { statusCode: 400, message: "Clinic hours are 8:00 AM to 8:00 PM. Please choose a time within clinic hours." };
  }
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

const BASE_SELECT = `
  SELECT
    a.*,
    a.time::text AS time,
    TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email,
    p.gender AS patient_gender,
    p.date_of_birth,
    p.age AS patient_age,
    bu.email AS booked_by_email,
    TRIM(CONCAT_WS(' ', bu.first_name, bu.last_name)) AS booked_by_name,
    u.first_name AS doctor_first_name,
    u.last_name AS doctor_last_name,
    TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS doctor_name,
    u.email AS doctor_email,
    s.specialty_name,
    s.slug AS specialty_slug,
    ((a.date + a.time) <= (NOW() AT TIME ZONE 'Asia/Manila')) AS is_past,
    (
      a.status IN ('COMPLETED','CANCELLED','NO_SHOW')
      OR (
        -- Pre-visit requests only. IN_QUEUE / FOR_BILLING mean the patient is
        -- physically mid-visit (in the queue / awaiting payment); they stay
        -- active until a terminal status and are never aged into history by the
        -- clock, so the patient's live visit-progress bar keeps advancing.
        a.status IN ('PENDING','CONFIRMED','RESCHEDULED')
        AND (a.date + a.time) <= (NOW() AT TIME ZONE 'Asia/Manila')
      )
    ) AS is_history,
    latest_mr.record_id AS latest_record_id,
    latest_mr.diagnosis AS latest_diagnosis,
    latest_mr.lab_requests AS requested_services,
    latest_mr.lab_requests AS lab_requests
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  JOIN users u ON a.doctor_id = u.user_id
  LEFT JOIN users bu ON a.booked_by = bu.user_id
  LEFT JOIN specialties s ON a.specialty_id = s.specialty_id
  LEFT JOIN LATERAL (
    SELECT mr.record_id, mr.diagnosis, mr.lab_requests, mr.visit_date, mr.created_at
    FROM medical_records mr
    WHERE mr.appointment_id = a.id
    ORDER BY COALESCE(mr.visit_date, mr.created_at::date) DESC, mr.record_id DESC
    LIMIT 1
  ) latest_mr ON true
`;

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
    booked_for = "self",
    booked_for_relationship = null,
  }) {
    assertNotPastManila(date, time);
    await assertNoDoctorConflict({ doctor_id, date, time });

    let result;
    try {
      result = await db.query(
        `INSERT INTO appointments
          (patient_id, doctor_id, specialty_id, date, time, type, chief_complaint, notes, booked_by, booked_for, booked_for_relationship, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING')
         RETURNING id`,
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
          normalizeBookedFor(booked_for),
          booked_for_relationship || null,
        ]
      );
    } catch (err) {
      // uq_doctor_datetime is the authoritative guard against two bookings
      // racing past assertNoDoctorConflict — surface a 409, not a 500.
      if (err.code === "23505" && err.constraint === "uq_doctor_datetime") {
        throw { statusCode: 409, message: "Doctor already has an active appointment at this time." };
      }
      throw err;
    }

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
    scope,
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
      conditions.push(`(p.user_id = $${params.length} OR a.booked_by = $${params.length})`);
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
    if (scope === "active") {
      params.push(ACTIVE_VISIBLE_STATUSES);
      conditions.push(`a.status = ANY($${params.length}) AND (a.date + a.time) > (NOW() AT TIME ZONE 'Asia/Manila')`);
    }
    if (scope === "history") {
      params.push(TERMINAL_STATUSES);
      // IN_QUEUE / FOR_BILLING are mid-visit (still active), so history is only
      // terminal statuses or pre-visit requests whose scheduled time has passed.
      conditions.push(`(a.status = ANY($${params.length}) OR (a.status = ANY('{PENDING,CONFIRMED,RESCHEDULED}'::varchar[]) AND (a.date + a.time) <= (NOW() AT TIME ZONE 'Asia/Manila')))`);
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
        bu.first_name ILIKE $${params.length} OR
        bu.last_name ILIKE $${params.length} OR
        CAST(a.id AS TEXT) ILIKE $${params.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const dataParams = [...params, safeLimit, offset];

    const orderSql = `
      ORDER BY
        CASE
          WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') AND (a.date + a.time) > (NOW() AT TIME ZONE 'Asia/Manila') THEN 0
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
        CASE WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') AND (a.date + a.time) > (NOW() AT TIME ZONE 'Asia/Manila') THEN a.date END ASC NULLS LAST,
        CASE WHEN a.status IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') AND (a.date + a.time) > (NOW() AT TIME ZONE 'Asia/Manila') THEN a.time END ASC NULLS LAST,
        CASE WHEN a.status NOT IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') OR (a.date + a.time) <= (NOW() AT TIME ZONE 'Asia/Manila') THEN a.date END DESC NULLS LAST,
        CASE WHEN a.status NOT IN ('PENDING','CONFIRMED','IN_QUEUE','RESCHEDULED') OR (a.date + a.time) <= (NOW() AT TIME ZONE 'Asia/Manila') THEN a.time END DESC NULLS LAST,
        a.id DESC`;

    const selectSql = `${BASE_SELECT} ${where} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.doctor_id = u.user_id
      LEFT JOIN users bu ON a.booked_by = bu.user_id
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
    const result = await db.query(`${BASE_SELECT} WHERE a.id = $1`, [id]);
    return result.rows[0] || null;
  },

  async getRawById(id) {
    const result = await db.query("SELECT *, time::text AS time, TO_CHAR(date, 'YYYY-MM-DD') AS date FROM appointments WHERE id = $1", [id]);
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

    assertNotPastManila(date, time, "New appointment schedule");

    const current = await this.getRawById(id);
    if (!current) throw { statusCode: 404, message: "Appointment not found." };
    if (["COMPLETED", "CANCELLED", "NO_SHOW", "IN_QUEUE"].includes(current.status)) {
      throw { statusCode: 400, message: `Cannot reschedule an appointment with status ${current.status}.` };
    }
    if (isPastManila(current.date, current.time)) {
      throw { statusCode: 400, message: "Past appointments are history and cannot be rescheduled." };
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

    let result;
    try {
      result = await db.query(
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
    } catch (err) {
      if (err.code === "23505" && err.constraint === "uq_doctor_datetime") {
        throw { statusCode: 409, message: "Doctor already has an active appointment at this time." };
      }
      throw err;
    }

    return this.findById(result.rows[0].id);
  },

  async getTodayByDoctor(doctorId) {
    const result = await db.query(
      `${BASE_SELECT}
       WHERE a.doctor_id = $1
         AND a.date = (NOW() AT TIME ZONE 'Asia/Manila')::date
         AND a.status NOT IN ('CANCELLED','NO_SHOW')
       ORDER BY a.time ASC`,
      [doctorId]
    );
    return result.rows;
  },

  // --------------------------------------------------------------------------
  // settlePastById
  //   Settle a SINGLE past, non-terminal appointment into a terminal state.
  //   Allowed targets: NO_SHOW (patient never came) or CANCELLED (with reason).
  //   Guards: must exist, must be past, must be currently non-terminal, and
  //   must not be IN_QUEUE (an in-queue/in-consultation visit is the doctor's
  //   workflow, not an admin "no show"). Returns the refreshed appointment.
  // --------------------------------------------------------------------------
  async settlePastById(id, status, { cancelled_by = null, cancel_reason = null } = {}) {
    const nextStatus = normalizeStatus(status);
    if (!["NO_SHOW", "CANCELLED"].includes(nextStatus)) {
      throw { statusCode: 400, message: "Past appointments can only be settled as NO_SHOW or CANCELLED." };
    }

    const current = await this.getRawById(id);
    if (!current) throw { statusCode: 404, message: "Appointment not found." };

    if (TERMINAL_STATUSES.includes(current.status)) {
      throw { statusCode: 400, message: `Appointment is already ${current.status} and needs no settling.` };
    }
    if (!isPastManila(current.date, current.time)) {
      throw { statusCode: 400, message: "This appointment is not in the past. Use the normal status actions." };
    }
    if (current.status === "IN_QUEUE") {
      throw { statusCode: 400, message: "An in-queue visit is completed through the consultation workflow, not settled here." };
    }
    if (nextStatus === "CANCELLED" && !String(cancel_reason || "").trim()) {
      throw { statusCode: 400, message: "Cancellation reason is required." };
    }

    const result = await db.query(
      `UPDATE appointments
          SET status = $1::varchar,
              cancelled_by = CASE WHEN $1::varchar = 'CANCELLED' THEN $2::integer ELSE cancelled_by END,
              cancel_reason = CASE
                                WHEN $1::varchar = 'CANCELLED' THEN $3::text
                                WHEN $1::varchar = 'NO_SHOW' THEN COALESCE(cancel_reason, 'Auto/closed: patient did not show.')
                                ELSE cancel_reason
                              END,
              updated_at = NOW()
        WHERE id = $4::integer
        RETURNING id`,
      [nextStatus, cancelled_by, cancel_reason || null, id]
    );

    if (!result.rows[0]) return null;
    return this.findById(result.rows[0].id);
  },

  // --------------------------------------------------------------------------
  // autoSettlePastAppointments
  //   Bulk sweep: any PENDING / CONFIRMED / RESCHEDULED appointment whose
  //   scheduled datetime has passed by more than `graceMinutes` is rolled to
  //   NO_SHOW so it can never sit in limbo. IN_QUEUE is intentionally excluded
  //   (the patient arrived; the doctor closes it). Returns the count settled.
  //   Idempotent and safe to run on an interval.
  // --------------------------------------------------------------------------
  async autoSettlePastAppointments({ graceMinutes = 120 } = {}) {
    const result = await db.query(
      `UPDATE appointments
          SET status = 'NO_SHOW',
              cancel_reason = COALESCE(cancel_reason, 'Auto-closed: appointment time passed without check-in.'),
              updated_at = NOW()
        WHERE status IN ('PENDING','CONFIRMED','RESCHEDULED')
          AND (date + time) <= ((NOW() AT TIME ZONE 'Asia/Manila') - ($1::text || ' minutes')::interval)
        RETURNING id`,
      [String(graceMinutes)]
    );
    return { settled: result.rowCount, ids: result.rows.map((r) => r.id) };
  },

  // --------------------------------------------------------------------------
  // assertAppointmentCooldown
  //   Anti-spam guard for patient self-service. If the patient cancelled an
  //   appointment within PATIENT_ACTION_COOLDOWN_SECONDS, block the next booking
  //   OR cancellation and tell them how long to wait. Uses the DB clock (no
  //   client clock skew). A patient who has never cancelled is never blocked.
  // --------------------------------------------------------------------------
  async assertAppointmentCooldown(userId) {
    const { rows } = await db.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))::int AS elapsed
         FROM appointments
        WHERE cancelled_by = $1::integer AND status = 'CANCELLED'`,
      [userId]
    );
    const elapsed = rows[0]?.elapsed;
    if (elapsed !== null && elapsed !== undefined && elapsed < PATIENT_ACTION_COOLDOWN_SECONDS) {
      const wait = PATIENT_ACTION_COOLDOWN_SECONDS - elapsed;
      throw {
        statusCode: 429,
        message: `You recently cancelled an appointment. Please wait ${wait} more second${wait === 1 ? "" : "s"} before booking or cancelling again.`,
      };
    }
  },

  // --------------------------------------------------------------------------
  // cancelByPatient
  //   Atomically cancel a patient's OWN appointment. The row is locked with
  //   SELECT ... FOR UPDATE and all rules are re-checked on the locked row
  //   inside the transaction, so two simultaneous cancel requests can't both go
  //   through: the first cancels, the second waits for the lock, then sees the
  //   already-CANCELLED row and returns a clean error instead of double-firing
  //   notifications/logs or corrupting state. Returns the fresh appointment.
  // --------------------------------------------------------------------------
  async cancelByPatient(id, userId, reason) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const current = (await client.query(
        `SELECT id, booked_by, status, TO_CHAR(date, 'YYYY-MM-DD') AS date, time::text AS time
           FROM appointments
          WHERE id = $1::integer
          FOR UPDATE`,
        [id]
      )).rows[0];

      if (!current) throw { statusCode: 404, message: "Appointment not found." };
      if (Number(current.booked_by) !== Number(userId)) {
        throw { statusCode: 403, message: "You can only cancel your own appointments." };
      }
      if (TERMINAL_STATUSES.includes(current.status)) {
        throw { statusCode: 400, message: `This appointment is already ${current.status.toLowerCase().replace("_", " ")}.` };
      }
      if (isPastManila(current.date, current.time)) {
        throw { statusCode: 400, message: "This appointment time has already passed. Please contact the clinic." };
      }
      if (!["PENDING", "RESCHEDULED"].includes(current.status)) {
        throw { statusCode: 400, message: "This appointment is already confirmed by the clinic. To change or cancel it, please call the clinic at (02) 8842-5405." };
      }

      await client.query(
        `UPDATE appointments
            SET status = 'CANCELLED',
                cancelled_by = $2::integer,
                cancel_reason = $3::text,
                updated_at = NOW()
          WHERE id = $1::integer`,
        [id, userId, reason]
      );

      await client.query("COMMIT");
      const appointment = await this.findById(id);
      return { appointment, fromStatus: current.status };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  // NOTE: the FOR_BILLING -> COMPLETED flip now happens inside Billing.create's
  // transaction (features/billing/models/Billing.js), atomically with payment.
};

Appointment.VALID_STATUSES = VALID_STATUSES;
Appointment.VALID_TYPES = VALID_TYPES;
Appointment.ACTIVE_VISIBLE_STATUSES = ACTIVE_VISIBLE_STATUSES;
Appointment.TERMINAL_STATUSES = TERMINAL_STATUSES;
Appointment.isPastManila = isPastManila;
Appointment.assertNotPastManila = assertNotPastManila;
Appointment.assertWithinClinicHours = assertWithinClinicHours;

module.exports = Appointment;
