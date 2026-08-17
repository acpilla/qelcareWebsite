const Queue = require("../models/Queue");
const Vital = require("../../vitals/models/Vital");
const logger = require("../../../shared/utils/activityLogger");
const { sweepStaleQueue } = require("../../../shared/utils/queueSweep");

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function writeLog(req, payload) {
  try {
    await logger.log({
      userId: req.user?.user_id,
      ip: logger.getIP(req),
      ...payload,
    });
  } catch (err) {
    console.error("Queue activity log error:", err);
  }
}

const STATUS_ROLE_RULES = {
  WAITING: ["Admin", "Nurse", "Frontdesk"],
  CALLED: ["Admin", "Nurse", "Doctor"],
  IN_PROGRESS: ["Admin", "Nurse", "Doctor"],
  SKIPPED: ["Admin", "Nurse", "Frontdesk"],
  DONE: ["Admin", "Doctor"],
  NO_SHOW: ["Admin", "Frontdesk"],
  CANCELLED: ["Admin", "Frontdesk"],
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function canRoleSetQueueStatus(role, status) {
  if (role === "Admin") return true;
  return (STATUS_ROLE_RULES[status] || []).includes(role);
}

async function assertQueueOwnership(req, queueId, nextStatus) {
  const entry = await Queue.findById(queueId);
  if (!entry) return null;

  if (req.user?.role === "Doctor" && Number(entry.doctor_id) !== Number(req.user.user_id)) {
    const err = new Error("Doctors can only update their own assigned queue patients.");
    err.statusCode = 403;
    throw err;
  }

  if (req.user?.role === "Doctor" && !["CALLED", "WAITING", "IN_PROGRESS", "DONE"].includes(nextStatus)) {
    const err = new Error("Doctors can only start or complete consultations.");
    err.statusCode = 403;
    throw err;
  }

  return entry;
}

const queueController = {
  async getDisplay(req, res) {
    try {
      const data = await Queue.getPublicDisplay();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Queue display error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch queue display data." });
    }
  },

  async getSpecialties(req, res) {
    try {
      const date = req.query.date || todayISO();
      // Self-heal the live queue: resolve stale / skipped no-shows before showing it.
      try { await sweepStaleQueue({ skipGraceMinutes: 30, clinicCloseHour: 20 }); }
      catch (sweepErr) { console.error("Queue sweep error:", sweepErr.message); }
      const specialties = await Queue.getSpecialties(date);
      res.json({ success: true, data: specialties, specialties });
    } catch (err) {
      console.error("Queue getSpecialties error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch queue specialties." });
    }
  },

  async getQueueBySpecialty(req, res) {
    try {
      const { specialtyId } = req.params;
      const date = req.query.date || todayISO();
      const queue = await Queue.findBySpecialtyAndDate(specialtyId, date);
      res.json({ success: true, data: queue, queue });
    } catch (err) {
      console.error("Queue getBySpecialty error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch queue." });
    }
  },

  async addToQueue(req, res) {
    try {
      const { appointment_id } = req.body || {};
      if (!appointment_id) {
        return res.status(400).json({ success: false, message: "appointment_id is required." });
      }

      const entry = await Queue.addToQueue(appointment_id);

      await writeLog(req, {
        action: "QUEUE_MANUAL_ADD",
        entityType: "queue",
        entityId: entry.queue_id,
        description: "Approved appointment was added to queue.",
        metadata: { appointment_id },
      });

      res.status(201).json({
        success: true,
        message: entry.alreadyQueued ? "Appointment is already in queue." : "Appointment added to queue.",
        data: entry,
        queue_entry: entry,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Queue addToQueue error:", err);
      res.status(500).json({ success: false, message: "Failed to add appointment to queue." });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status, notes } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: "Status is required." });
      }

      const nextStatus = normalizeStatus(status);
      if (!canRoleSetQueueStatus(req.user?.role, nextStatus)) {
        return res.status(403).json({
          success: false,
          message: `${req.user?.role || "This role"} cannot set queue status to ${nextStatus}.`,
        });
      }

      const existingEntry = await assertQueueOwnership(req, req.params.queueId, nextStatus);
      if (!existingEntry) return res.status(404).json({ success: false, message: "Queue entry not found." });

      // Vitals are mandatory: a patient's visit cannot be completed (marked DONE)
      // until the nurse has recorded their vitals for this appointment.
      if (nextStatus === "DONE" && existingEntry.appointment_id) {
        const vitals = await Vital.findByAppointment(existingEntry.appointment_id);
        if (!vitals || vitals.length === 0) {
          return res.status(400).json({
            success: false,
            code: "VITALS_REQUIRED",
            message: "Vitals must be recorded for this patient before the visit can be completed.",
          });
        }
      }

      const entry = await Queue.updateStatus(req.params.queueId, nextStatus, notes);
      if (!entry) return res.status(404).json({ success: false, message: "Queue entry not found." });

      await writeLog(req, {
        action: "QUEUE_STATUS_CHANGED",
        entityType: "queue",
        entityId: entry.queue_id,
        description: `Queue #${entry.queue_number} changed to ${entry.status}`,
        metadata: {
          queue_id: entry.queue_id,
          appointment_id: entry.appointment_id,
          status: entry.status,
        },
      });

      res.json({
        success: true,
        message: "Queue status updated.",
        data: entry,
        queue_entry: entry,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Queue updateStatus error:", err);
      res.status(500).json({ success: false, message: "Failed to update queue status." });
    }
  },

  async autoEnqueue(req, res) {
    try {
      const date = req.body?.date || req.query.date || todayISO();
      const result = await Queue.autoEnqueueConfirmed(date);

      await writeLog(req, {
        action: "QUEUE_AUTO_ENQUEUE",
        entityType: "queue",
        entityId: null,
        description: `Auto-enqueued confirmed appointments for ${date}.`,
        metadata: {
          date,
          added_count: result.added_count,
          failed_count: result.failed_count,
        },
      });

      res.json({
        success: true,
        message: `${result.added_count} confirmed appointment(s) added to queue.`,
        data: result,
      });
    } catch (err) {
      console.error("Auto enqueue error:", err);
      res.status(500).json({ success: false, message: "Failed to auto-enqueue confirmed appointments." });
    }
  },
};

module.exports = queueController;
