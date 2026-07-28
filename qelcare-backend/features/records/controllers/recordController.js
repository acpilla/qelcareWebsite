const MedicalRecord = require("../models/MedicalRecord");
const Patient = require("../../patient/models/Patient");
const logger = require("../../../shared/utils/activityLogger");

function getRecordId(record) {
  return record?.record_id || record?.id;
}

async function writeLog(req, payload) {
  try {
    await logger.log({
      userId: req.user?.user_id,
      ip: logger.getIP(req),
      ...payload,
    });
  } catch (err) {
    console.error("Medical record activity log error:", err);
  }
}

// Identity handed to the model so confidential records are filtered per-role.
function viewerOf(req) {
  return { role: req.user?.role, userId: req.user?.user_id };
}

function assertDoctorOwnsRecord(req, record) {
  if (req.user?.role !== "Doctor") return;
  const recordDoctorId = Number(record.doctor_id || 0);
  if (recordDoctorId && recordDoctorId !== Number(req.user.user_id)) {
    const err = new Error("Doctors can only update their own medical records.");
    err.statusCode = 403;
    throw err;
  }
}

const recordController = {
  async create(req, res) {
    try {
      if (req.user?.role !== "Doctor") {
        return res.status(403).json({ success: false, message: "Only doctors can create medical records." });
      }

      const patientId = req.body.patient_id ? Number(req.body.patient_id) : null;
      if (!patientId) {
        return res.status(400).json({ success: false, message: "patient_id is required." });
      }

      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient not found." });
      }

      const record = await MedicalRecord.create({
        ...req.body,
        patient_id: patientId,
        doctor_id: req.user.user_id,
        created_by: req.user.user_id,
      });

      await writeLog(req, {
        action: "RECORD_CREATED",
        entityType: "medical_record",
        entityId: getRecordId(record),
        description: `Medical record #${getRecordId(record)} created for patient #${patientId}`,
        metadata: { patient_id: patientId, appointment_id: req.body.appointment_id || null },
      });

      res.status(201).json({
        success: true,
        message: "Medical record created.",
        data: record,
        record,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Create record error:", err);
      res.status(500).json({ success: false, message: "Failed to create medical record." });
    }
  },

  async getAll(req, res) {
    try {
      const result = await MedicalRecord.findAll({
        search: req.query.search || "",
        patient_id: req.query.patient_id || null,
        doctor_id: req.user?.role === "Doctor" ? req.user.user_id : req.query.doctor_id || null,
        appointment_id: req.query.appointment_id || null,
        date_from: req.query.date_from || null,
        date_to: req.query.date_to || null,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        viewer: viewerOf(req),
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Get records error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch medical records." });
    }
  },

  async getById(req, res) {
    try {
      // Viewer-filtered: a confidential record a role may not see 404s
      // (no existence leak).
      const record = await MedicalRecord.findById(req.params.id, viewerOf(req));
      if (!record) return res.status(404).json({ success: false, message: "Medical record not found." });
      res.json({ success: true, data: record, record });
    } catch (err) {
      console.error("Get record error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch medical record." });
    }
  },

  async getByPatient(req, res) {
    try {
      const records = await MedicalRecord.findByPatient(req.params.patientId, viewerOf(req));
      res.json({ success: true, data: records, records });
    } catch (err) {
      console.error("Get patient records error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch patient medical records." });
    }
  },

  async getMyRecords(req, res) {
    try {
      const patient = await Patient.findByUserId(req.user.user_id);
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient profile not found." });
      }

      // Patients see all of their OWN records, including confidential ones.
      const records = await MedicalRecord.findByPatient(patient.id, { role: "PatientSelf" });
      res.json({ success: true, data: records, records });
    } catch (err) {
      console.error("Get my records error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch your medical records." });
    }
  },

  async update(req, res) {
    try {
      if (req.user?.role !== "Doctor") {
        return res.status(403).json({ success: false, message: "Only doctors can update medical records." });
      }

      const current = await MedicalRecord.findById(req.params.id);
      if (!current) return res.status(404).json({ success: false, message: "Medical record not found." });
      assertDoctorOwnsRecord(req, current);

      const record = await MedicalRecord.update(req.params.id, {
        ...req.body,
        doctor_id: current.doctor_id || req.user.user_id,
      });
      if (!record) return res.status(404).json({ success: false, message: "Medical record not found." });

      await writeLog(req, {
        action: "RECORD_UPDATED",
        entityType: "medical_record",
        entityId: getRecordId(record),
        description: `Medical record #${getRecordId(record)} updated`,
        metadata: { patient_id: record.patient_id, appointment_id: record.appointment_id || null },
      });

      res.json({
        success: true,
        message: "Medical record updated.",
        data: record,
        record,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Update record error:", err);
      res.status(500).json({ success: false, message: "Failed to update medical record." });
    }
  },
};

module.exports = recordController;
