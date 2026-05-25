const Queue = require("../models/Queue");
const logger = require("../../../shared/utils/activityLogger");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

      await writeLog(req, {
        action: "QUEUE_MANUAL_ADD_BLOCKED",
        entityType: "queue",
        entityId: null,
        description: "Manual queue creation was blocked because queue entries are created after cashier payment.",
        metadata: { appointment_id: appointment_id || null },
      });

      res.status(409).json({
        success: false,
        message: "Queue entries are created only after cashier payment.",
      });
    } catch (err) {
      console.error("Queue addToQueue block error:", err);
      res.status(500).json({ success: false, message: "Failed to block manual queue request." });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status, notes } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: "Status is required." });
      }

      const entry = await Queue.updateStatus(req.params.queueId, status, notes);
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
      await writeLog(req, {
        action: "QUEUE_AUTO_ENQUEUE_BLOCKED",
        entityType: "queue",
        entityId: null,
        description: "Attempted auto-enqueue was blocked because queue entries are created after payment.",
        metadata: { date: req.body?.date || req.query.date || todayISO() },
      });

      res.status(409).json({
        success: false,
        message: "Queue entries are created only after cashier payment.",
      });
    } catch (err) {
      console.error("Auto enqueue error:", err);
      res.status(500).json({ success: false, message: "Failed to block auto-enqueue request." });
    }
  },
};

module.exports = queueController;