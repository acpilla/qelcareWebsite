const Appointment = require("../models/Appointment");
const Patient = require("../../patient/models/Patient");
const logger = require("../../../shared/utils/activityLogger");

const TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
  CONFIRMED: ["CANCELLED", "RESCHEDULED", "NO_SHOW"],
  IN_QUEUE: ["COMPLETED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
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

      const appointment = await Appointment.updateStatus(req.params.id, nextStatus, {
        cancelled_by: req.user.user_id,
        cancel_reason,
      });

      await logger.log({
        userId: req.user.user_id,
        action: "APPT_STATUS_CHANGED",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Appointment #${appointment.id} status changed from ${current.status} to ${nextStatus}`,
        ip: logger.getIP(req),
        metadata: { from: current.status, to: nextStatus, cancel_reason },
      });

      res.json({ success: true, message: "Status updated.", data: appointment, appointment });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Update status error:", err);
      res.status(500).json({ success: false, message: "Failed to update status." });
    }
  },

  async reschedule(req, res) {
    try {
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

      res.status(201).json({ success: true, message: "Appointment booked.", data: appointment, appointment });
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
