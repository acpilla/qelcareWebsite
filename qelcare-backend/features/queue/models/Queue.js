const db = require("../../../config/database");

const VALID_QUEUE_STATUSES = ["WAITING", "IN_PROGRESS", "DONE", "SKIPPED"];

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function appError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function findEntryById(queueId, client = db) {
  const result = await client.query(
    `SELECT
       q.queue_id,
       q.appointment_id,
       q.specialty_id,
       q.queue_number,
       TO_CHAR(q.queue_date, 'YYYY-MM-DD') AS queue_date,
       q.status,
       q.called_at,
       q.started_at,
       q.completed_at,
       q.notes,
       q.priority,
       q.created_at,
       q.updated_at,
       a.id AS appointment_id,
       TO_CHAR(a.date, 'YYYY-MM-DD') AS appointment_date,
       a.time::text AS appointment_time,
       a.status AS appointment_status,
       a.type AS appointment_type,
       a.chief_complaint,
       a.notes AS appointment_notes,
       p.id AS patient_id,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
       p.phone AS patient_phone,
       p.email AS patient_email,
       p.gender AS patient_gender,
       p.date_of_birth,
       u.user_id AS doctor_id,
       NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS doctor_name,
       u.email AS doctor_email,
       s.specialty_name,
       s.slug AS specialty_slug
     FROM queue_entries q
     JOIN appointments a ON q.appointment_id = a.id
     JOIN patients p ON a.patient_id = p.id
     JOIN users u ON a.doctor_id = u.user_id
     JOIN specialties s ON q.specialty_id = s.specialty_id
     WHERE q.queue_id = $1`,
    [queueId]
  );

  return result.rows[0] || null;
}

const Queue = {
  async findById(queueId) {
    return findEntryById(queueId);
  },

  async getSpecialties(date = todayISO()) {
    const result = await db.query(
      `SELECT
         s.specialty_id,
         s.specialty_name,
         s.slug,
         s.display_order,
         s.is_active,
         COUNT(q.queue_id)::int AS total,
         COUNT(q.queue_id) FILTER (WHERE q.status = 'WAITING')::int AS waiting,
         COUNT(q.queue_id) FILTER (WHERE q.status = 'IN_PROGRESS')::int AS in_progress,
         COUNT(q.queue_id) FILTER (WHERE q.status = 'SKIPPED')::int AS skipped,
         COUNT(q.queue_id) FILTER (WHERE q.status = 'DONE')::int AS done
       FROM specialties s
       LEFT JOIN queue_entries q
         ON q.specialty_id = s.specialty_id
        AND q.queue_date = $1::date
       WHERE COALESCE(s.is_active, true) = true
       GROUP BY s.specialty_id, s.specialty_name, s.slug, s.display_order, s.is_active
       ORDER BY COALESCE(s.display_order, 0), s.specialty_name`,
      [date || todayISO()]
    );

    return result.rows;
  },

  async findBySpecialtyAndDate(specialtyId, date = todayISO()) {
    const result = await db.query(
      `SELECT
         q.queue_id,
         q.appointment_id,
         q.specialty_id,
         q.queue_number,
         TO_CHAR(q.queue_date, 'YYYY-MM-DD') AS queue_date,
         q.status,
         q.called_at,
         q.started_at,
         q.completed_at,
         q.notes,
         q.priority,
         q.created_at,
         q.updated_at,
         TO_CHAR(a.date, 'YYYY-MM-DD') AS appointment_date,
         a.time::text AS appointment_time,
         a.status AS appointment_status,
         a.type AS appointment_type,
         a.chief_complaint,
         a.notes AS appointment_notes,
         p.id AS patient_id,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
         p.phone AS patient_phone,
         p.email AS patient_email,
         p.gender AS patient_gender,
         p.date_of_birth,
         u.user_id AS doctor_id,
         NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS doctor_name,
         u.email AS doctor_email,
         s.specialty_name,
         s.slug AS specialty_slug
       FROM queue_entries q
       JOIN appointments a ON q.appointment_id = a.id
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.user_id
       JOIN specialties s ON q.specialty_id = s.specialty_id
       WHERE q.specialty_id = $1
         AND q.queue_date = $2::date
       ORDER BY
         CASE q.status
           WHEN 'IN_PROGRESS' THEN 1
           WHEN 'WAITING' THEN 2
           WHEN 'SKIPPED' THEN 3
           WHEN 'DONE' THEN 4
           ELSE 5
         END,
         q.priority DESC,
         q.queue_number ASC`,
      [specialtyId, date || todayISO()]
    );

    return result.rows;
  },

  async addToQueue(appointmentId) {
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const apptResult = await client.query(
        `SELECT id, specialty_id, date, status
         FROM appointments
         WHERE id = $1
         FOR UPDATE`,
        [appointmentId]
      );

      const appointment = apptResult.rows[0];
      if (!appointment) throw appError(404, "Appointment not found.");
      if (!appointment.specialty_id) throw appError(400, "Appointment has no specialty assigned.");

      const existing = await client.query(
        `SELECT queue_id, status
         FROM queue_entries
         WHERE appointment_id = $1
         LIMIT 1`,
        [appointmentId]
      );

      if (existing.rows[0]) {
        if (existing.rows[0].status !== "DONE" && appointment.status !== "IN_QUEUE") {
          await client.query(
            `UPDATE appointments
             SET status = 'IN_QUEUE', updated_at = NOW()
             WHERE id = $1`,
            [appointmentId]
          );
        }

        await client.query("COMMIT");
        const entry = await findEntryById(existing.rows[0].queue_id);
        return { ...entry, alreadyQueued: true };
      }

      if (!["CONFIRMED", "IN_QUEUE"].includes(appointment.status)) {
        throw appError(400, "Only confirmed or already queued appointments can be added to the queue.");
      }

      await client.query("LOCK TABLE queue_entries IN SHARE ROW EXCLUSIVE MODE");

      const numberResult = await client.query(
        `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_number
         FROM queue_entries
         WHERE specialty_id = $1
           AND queue_date = $2::date`,
        [appointment.specialty_id, appointment.date]
      );

      const queueNumber = numberResult.rows[0].next_number;

      const insertResult = await client.query(
        `INSERT INTO queue_entries
           (appointment_id, specialty_id, queue_number, queue_date, status)
         VALUES ($1, $2, $3, $4, 'WAITING')
         RETURNING queue_id`,
        [appointmentId, appointment.specialty_id, queueNumber, appointment.date]
      );

      await client.query(
        `UPDATE appointments
         SET status = 'IN_QUEUE', updated_at = NOW()
         WHERE id = $1`,
        [appointmentId]
      );

      await client.query("COMMIT");
      return findEntryById(insertResult.rows[0].queue_id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async updateStatus(queueId, status, notes = null) {
    const nextStatus = normalizeStatus(status);
    if (!VALID_QUEUE_STATUSES.includes(nextStatus)) {
      throw appError(400, `Invalid queue status. Use: ${VALID_QUEUE_STATUSES.join(", ")}`);
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const currentResult = await client.query(
        `SELECT queue_id, appointment_id, status
         FROM queue_entries
         WHERE queue_id = $1
         FOR UPDATE`,
        [queueId]
      );

      const current = currentResult.rows[0];
      if (!current) {
        await client.query("ROLLBACK");
        return null;
      }

      if (current.status === "DONE" && nextStatus !== "DONE") {
        throw appError(400, "Completed queue entries cannot be reopened.");
      }

      const updateResult = await client.query(
        `UPDATE queue_entries
         SET status = $1,
             notes = COALESCE($2, notes),
             called_at = CASE
               WHEN $1 = 'IN_PROGRESS' AND called_at IS NULL THEN NOW()
               ELSE called_at
             END,
             started_at = CASE
               WHEN $1 = 'IN_PROGRESS' THEN NOW()
               WHEN $1 = 'WAITING' THEN NULL
               ELSE started_at
             END,
             completed_at = CASE
               WHEN $1 = 'DONE' THEN NOW()
               WHEN $1 IN ('WAITING', 'IN_PROGRESS', 'SKIPPED') THEN NULL
               ELSE completed_at
             END,
             updated_at = NOW()
         WHERE queue_id = $3
         RETURNING queue_id`,
        [nextStatus, notes || null, queueId]
      );

      const appointmentStatus = nextStatus === "DONE" ? "COMPLETED" : "IN_QUEUE";
      await client.query(
        `UPDATE appointments
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [appointmentStatus, current.appointment_id]
      );

      await client.query("COMMIT");
      return findEntryById(updateResult.rows[0].queue_id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async autoEnqueueConfirmed(date = todayISO()) {
    const result = await db.query(
      `SELECT id
       FROM appointments
       WHERE status = 'CONFIRMED'
         AND date = $1::date
         AND specialty_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM queue_entries q
           WHERE q.appointment_id = appointments.id
         )
       ORDER BY time ASC, id ASC`,
      [date || todayISO()]
    );

    const added = [];
    const failed = [];

    for (const appointment of result.rows) {
      try {
        const entry = await this.addToQueue(appointment.id);
        added.push(entry);
      } catch (err) {
        failed.push({
          appointment_id: appointment.id,
          message: err.message || "Failed to add appointment to queue.",
        });
      }
    }

    return {
      date: date || todayISO(),
      added,
      added_count: added.length,
      failed,
      failed_count: failed.length,
    };
  },

  async getPublicDisplay() {
    const [specs, queue] = await Promise.all([
      db.query(
        `SELECT specialty_id, specialty_name
         FROM specialties
         WHERE COALESCE(is_active, true) = true
         ORDER BY COALESCE(display_order, 0), specialty_name`
      ),
      db.query(
        `SELECT
           q.queue_id,
           q.queue_number,
           q.specialty_id,
           q.status,
           q.called_at,
           COALESCE(
             NULLIF(TRIM(CONCAT_WS(
               ' ',
               p.first_name,
               CASE
                 WHEN NULLIF(TRIM(COALESCE(p.last_name, '')), '') IS NOT NULL
                   THEN LEFT(TRIM(p.last_name), 1) || '.'
                 ELSE NULL
               END
             )), ''),
             p.name
           ) AS patient_name
         FROM queue_entries q
         JOIN appointments a ON q.appointment_id = a.id
         JOIN patients p ON a.patient_id = p.id
         WHERE q.queue_date = CURRENT_DATE
           AND q.status IN ('WAITING', 'IN_PROGRESS')
         ORDER BY
           CASE q.status WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
           q.queue_number ASC`
      ),
    ]);

    return {
      specialties: specs.rows,
      queue: queue.rows,
    };
  },
};

module.exports = Queue;
