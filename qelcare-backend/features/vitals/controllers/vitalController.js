const Vital = require("../models/Vital");
const Patient = require("../../patient/models/Patient");
const logger = require("../../../shared/utils/activityLogger");

async function writeLog(req, payload) {
  try {
    await logger.log({
      userId: req.user?.user_id,
      ip: logger.getIP(req),
      ...payload,
    });
  } catch (err) {
    console.error("Vitals activity log error:", err);
  }
}

const vitalController = {
  async create(req, res) {
    try {
      const patientId = req.body.patient_id ? Number(req.body.patient_id) : null;
      if (!patientId) {
        return res.status(400).json({ success: false, message: "patient_id is required." });
      }

      const patient = await Patient.findById(patientId);
      if (!patient) return res.status(404).json({ success: false, message: "Patient not found." });

      const vital = await Vital.create({
        ...req.body,
        patient_id: patientId,
        nurse_id: req.user.user_id,
      });

      await writeLog(req, {
        action: "VITALS_RECORDED",
        entityType: "vitals",
        entityId: vital.id,
        description: `Vitals recorded for patient #${patientId}`,
        metadata: { patient_id: patientId, appointment_id: req.body.appointment_id || null },
      });

      res.status(201).json({
        success: true,
        message: "Vitals recorded.",
        data: vital,
        vital,
      });
    } catch (err) {
      console.error("Create vitals error:", err);
      res.status(500).json({ success: false, message: "Failed to record vitals." });
    }
  },

  async getById(req, res) {
    try {
      const vital = await Vital.findById(req.params.id);
      if (!vital) return res.status(404).json({ success: false, message: "Vitals not found." });
      res.json({ success: true, data: vital, vital });
    } catch (err) {
      console.error("Get vitals error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch vitals." });
    }
  },

  async getByPatient(req, res) {
    try {
      const vitals = await Vital.findByPatient(req.params.patientId);
      res.json({ success: true, data: vitals, vitals });
    } catch (err) {
      console.error("Get vitals by patient error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch patient vitals." });
    }
  },

  async getByAppointment(req, res) {
    try {
      const vitals = await Vital.findByAppointment(req.params.appointmentId);
      res.json({ success: true, data: vitals, vitals });
    } catch (err) {
      console.error("Get vitals by appointment error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch appointment vitals." });
    }
  },

  async getLatest(req, res) {
    try {
      const vital = await Vital.findLatestByPatient(req.params.patientId);
      if (!vital) return res.status(404).json({ success: false, message: "No vitals found." });
      res.json({ success: true, data: vital, vital });
    } catch (err) {
      console.error("Get latest vitals error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch latest vitals." });
    }
  },

  async getMyVitals(req, res) {
    try {
      const patient = await Patient.findByUserId(req.user.user_id);
      if (!patient) return res.status(404).json({ success: false, message: "Patient profile not found." });

      const vitals = await Vital.findByPatient(patient.id);
      res.json({ success: true, data: vitals, vitals });
    } catch (err) {
      console.error("Get my vitals error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch your vitals." });
    }
  },
};

module.exports = vitalController;
