const { Readable } = require("stream");
const cloudinary = require("../../../config/cloudinary");
const Patient = require("../../patient/models/Patient");
const PatientResult = require("../models/PatientResult");

function patientName(patient) {
  return patient?.display_name || patient?.name || [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "Patient";
}

async function getMyPatient(req) {
  const patient = await Patient.findByUserId(req.user.user_id);
  if (!patient) {
    const err = new Error("Patient profile not found.");
    err.statusCode = 404;
    throw err;
  }
  return patient;
}

function uploadToCloudinary(file) {
  if (!file) return Promise.resolve({});

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "qelcare-patient-results",
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          file_url: result.secure_url,
          file_public_id: result.public_id,
          file_mime: file.mimetype,
        });
      }
    );

    Readable.from(file.buffer).pipe(upload);
  });
}

const patientResultController = {
  async getMine(req, res) {
    try {
      const patient = await getMyPatient(req);
      const results = await PatientResult.findByPatient(patient.id, { search: req.query.search || "" });
      res.json({ success: true, patient: { id: patient.id, name: patientName(patient) }, data: results, results });
    } catch (err) {
      const status = err.statusCode || 500;
      console.error("Patient results getMine error:", err);
      res.status(status).json({ success: false, message: err.message || "Failed to fetch medical results." });
    }
  },

  async create(req, res) {
    try {
      const patient = await getMyPatient(req);
      const title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ success: false, message: "Title is required." });
      }

      const fileData = await uploadToCloudinary(req.file);
      const result = await PatientResult.create(patient.id, req.user.user_id, req.body, fileData);
      res.status(201).json({ success: true, message: "Medical result saved.", data: result, result });
    } catch (err) {
      const status = err.statusCode || 500;
      console.error("Patient results create error:", err);
      res.status(status).json({ success: false, message: err.message || "Failed to save medical result." });
    }
  },

  async update(req, res) {
    try {
      const patient = await getMyPatient(req);
      const title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ success: false, message: "Title is required." });
      }

      const result = await PatientResult.updateOwned(req.params.id, patient.id, req.body);
      if (!result) return res.status(404).json({ success: false, message: "Medical result not found." });
      res.json({ success: true, message: "Medical result updated.", data: result, result });
    } catch (err) {
      const status = err.statusCode || 500;
      console.error("Patient results update error:", err);
      res.status(status).json({ success: false, message: err.message || "Failed to update medical result." });
    }
  },

  async remove(req, res) {
    try {
      const patient = await getMyPatient(req);
      const existing = await PatientResult.findOwned(req.params.id, patient.id);
      if (!existing) return res.status(404).json({ success: false, message: "Medical result not found." });

      const deleted = await PatientResult.softDeleteOwned(req.params.id, patient.id);

      if (existing.file_public_id) {
        const resourceType = existing.file_mime === "application/pdf" ? "raw" : "image";
        cloudinary.uploader.destroy(existing.file_public_id, { resource_type: resourceType }).catch(() => null);
      }

      res.json({ success: true, message: "Medical result deleted.", data: deleted, result: deleted });
    } catch (err) {
      const status = err.statusCode || 500;
      console.error("Patient results delete error:", err);
      res.status(status).json({ success: false, message: err.message || "Failed to delete medical result." });
    }
  },
};

module.exports = patientResultController;
