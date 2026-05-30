const Appointment = require("../models/Appointment");
const Patient = require("../../patient/models/Patient");
const Queue = require("../../queue/models/Queue");
const logger = require("../../../shared/utils/activityLogger");

const TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_QUEUE", "CANCELLED", "NO_SHOW"],
  IN_QUEUE: ["CANCELLED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const APPOINTMENT_STATUS_ROLES = {
  CONFIRMED: ["Admin", "Frontdesk"],
  IN_QUEUE: ["Admin", "Frontdesk"],
  CANCELLED: ["Admin", "Frontdesk"],
  NO_SHOW: ["Admin", "Frontdesk"],
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function hasRole(req, allowedRoles) {
  return allowedRoles.includes(req.user?.role);
}

function todayManilaISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const appointmentController = {
  async create(req, res) {
    try {
      const { patient_id, doctor_id, date, time } = req.body;
      if (!patient_id || !doctor_id || !date || !time) {
        return res.status(400).json({
          success: false,
          message: "patient_id, doctor_id, date, and time are required.",
        });
      }

      const appointment = await Appointment.create({
        ...req.body,
        booked_by: req.user.user_id,
      });

      await logger.log({
        userId: req.user.user_id,
        action: "APPT_CREATED",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Appointment created for patient #${patient_id} on ${date} ${time}`,
        ip: logger.getIP(req),
      });

      res.status(201).json({
        success: true,
        message: "Appointment created.",
        data: appointment,
        appointment,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Create appointment error:", err);
      res.status(500).json({ success: false, message: "Failed to create appointment." });
    }
  },

  async getAll(req, res) {
    try {
      const { role, user_id } = req.user;
      const {
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
      } = req.query;

      const result = await Appointment.findAll({
        role,
        userId: user_id,
        status,
        date,
        date_from,
        date_to,
        specialty_id,
        doctor_id,
        patient_id,
        search,
        page,
        limit,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Get appointments error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch appointments." });
    }
  },

  async getById(req, res) {
    try {
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });
      res.json({ success: true, data: appointment, appointment });
    } catch (err) {
      console.error("Get appointment error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch appointment." });
    }
  },

  async updateStatus(req, res) {
    try {
      const nextStatus = normalizeStatus(req.body.status);
      const { cancel_reason } = req.body;
      if (!nextStatus) return res.status(400).json({ success: false, message: "Status is required." });

      const allowedRoles = APPOINTMENT_STATUS_ROLES[nextStatus] || [];
      if (allowedRoles.length && !hasRole(req, allowedRoles)) {
        return res.status(403).json({
          success: false,
          message: `${req.user?.role || "This role"} cannot change appointments to ${nextStatus}.`,
        });
      }

      if (nextStatus === "COMPLETED") {
        return res.status(400).json({
          success: false,
          message: "Doctors complete visits through the queue/consultation workflow, not direct appointment status editing.",
        });
      }

      const current = await Appointment.getRawById(req.params.id);
      if (!current) return res.status(404).json({ success: false, message: "Appointment not found." });

      if (!canTransition(current.status, nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change appointment from ${current.status} to ${nextStatus}.`,
        });
      }

      if (nextStatus === "CANCELLED" && !String(cancel_reason || "").trim()) {
        return res.status(400).json({ success: false, message: "Cancellation reason is required." });
      }

      let appointment = await Appointment.updateStatus(req.params.id, nextStatus, {
        cancelled_by: req.user.user_id,
        cancel_reason,
      });
      let queueEntry = null;
      let finalStatus = nextStatus;
      let message = "Status updated.";

      if (nextStatus === "CONFIRMED") {
        if (dateOnly(current.date) === todayManilaISO()) {
          queueEntry = await Queue.addToQueue(req.params.id);
          appointment = await Appointment.findById(req.params.id);
          finalStatus = "IN_QUEUE";
          message = "Appointment approved and added to today's queue.";
        } else {
          message = "Appointment approved. It will stay confirmed until the appointment date.";
        }
      }

      if (nextStatus === "IN_QUEUE") {
        if (dateOnly(current.date) !== todayManilaISO()) {
          return res.status(400).json({
            success: false,
            message: "Only today's confirmed appointments can enter the live queue.",
          });
        }

        queueEntry = await Queue.addToQueue(req.params.id);
        appointment = await Appointment.findById(req.params.id);
        finalStatus = "IN_QUEUE";
        message = "Appointment added to today's queue.";
      }

      await logger.log({
        userId: req.user.user_id,
        action: "APPT_STATUS_CHANGED",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Appointment #${appointment.id} status changed from ${current.status} to ${finalStatus}`,
        ip: logger.getIP(req),
        metadata: {
          from: current.status,
          requested_status: nextStatus,
          final_status: finalStatus,
          cancel_reason,
          queue_id: queueEntry?.queue_id || null,
          queue_number: queueEntry?.queue_number || null,
        },
      });

      res.json({
        success: true,
        message,
        data: appointment,
        appointment,
        queue_entry: queueEntry,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Update status error:", err);
      res.status(500).json({ success: false, message: "Failed to update status." });
    }
  },

  async reschedule(req, res) {
    try {
      if (!hasRole(req, ["Admin", "Frontdesk"])) {
        return res.status(403).json({
          success: false,
          message: `${req.user?.role || "This role"} cannot reschedule appointments.`,
        });
      }

      const { date, time } = req.body;
      const appointment = await Appointment.reschedule(req.params.id, { date, time });

      await logger.log({
        userId: req.user.user_id,
        action: "APPT_RESCHEDULED",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Appointment #${appointment.id} rescheduled to ${date} ${time}`,
        ip: logger.getIP(req),
      });

      res.json({
        success: true,
        message: "Appointment rescheduled and returned to pending confirmation.",
        data: appointment,
        appointment,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Reschedule error:", err);
      res.status(500).json({ success: false, message: "Failed to reschedule." });
    }
  },

  async getTodayByDoctor(req, res) {
    try {
      const doctorId = req.params.doctorId || req.user.user_id;
      const appointments = await Appointment.getTodayByDoctor(doctorId);
      res.json({ success: true, data: appointments, appointments });
    } catch (err) {
      console.error("Get today appointments error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch today's appointments." });
    }
  },

  async bookMyAppointment(req, res) {
    try {
      const patient = await Patient.findByUserId(req.user.user_id);
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient profile not found. Contact the clinic." });
      }

      const { doctor_id, date, time } = req.body;
      if (!doctor_id || !date || !time) {
        return res.status(400).json({ success: false, message: "doctor_id, date, and time are required." });
      }

      const appointment = await Appointment.create({
        ...req.body,
        patient_id: patient.id,
        booked_by: req.user.user_id,
        type: req.body.type || "consultation",
      });

      await logger.log({
        userId: req.user.user_id,
        action: "APPT_CREATED",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Patient self-booked appointment on ${date} ${time}`,
        ip: logger.getIP(req),
      });

      res.status(201).json({
        success: true,
        message: "Appointment booked. Please wait for Frontdesk/Admin approval. Once approved, it will enter the clinic queue.",
        data: appointment,
        appointment,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Book appointment error:", err);
      res.status(500).json({ success: false, message: "Failed to book appointment." });
    }
  },

  async getMyAppointments(req, res) {
    try {
      const patient = await Patient.findByUserId(req.user.user_id);
      if (!patient) return res.status(404).json({ success: false, message: "Patient profile not found." });

      const result = await Appointment.findAll({
        role: "Patient",
        userId: req.user.user_id,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Get my appointments error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch appointments." });
    }
  },
};

module.exports = appointmentController;
