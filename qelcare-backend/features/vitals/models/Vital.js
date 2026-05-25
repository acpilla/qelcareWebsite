const db = require("../../../config/database");

function clean(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function numberOrNull(value) {
  const cleaned = clean(value);
  if (cleaned === null) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeInput(input = {}) {
  const oxygen = input.oxygen_sat ?? input.oxygen_saturation ?? input.o2_saturation;
  const heartRate = input.heart_rate ?? input.pulse_rate;
  const weight = input.weight ?? input.weight_kg;
  const height = input.height ?? input.height_cm;
  const notes = input.notes ?? input.nurse_notes;

  return {
    patient_id: numberOrNull(input.patient_id),
    appointment_id: numberOrNull(input.appointment_id),
    nurse_id: numberOrNull(input.nurse_id ?? input.recorded_by),
    blood_pressure: clean(input.blood_pressure),
    heart_rate: numberOrNull(heartRate),
    temperature: numberOrNull(input.temperature),
    weight: numberOrNull(weight),
    height: numberOrNull(height),
    oxygen_sat: numberOrNull(oxygen),
    o2_saturation: numberOrNull(input.o2_saturation ?? oxygen),
    notes: clean(notes),
    chief_complaint: clean(input.chief_complaint),
    nurse_notes: clean(input.nurse_notes ?? notes),
    lmp: clean(input.lmp),
    routed_to_specialty_id: numberOrNull(input.routed_to_specialty_id),
  };
}

const SELECT_VITAL = `
  SELECT
    v.id,
    v.id AS vital_id,
    v.patient_id,
    v.appointment_id,
    v.nurse_id,
    v.nurse_id AS recorded_by,
    v.blood_pressure,
    v.heart_rate,
    v.heart_rate AS pulse_rate,
    v.temperature,
    v.weight,
    v.weight AS weight_kg,
    v.height,
    v.height AS height_cm,
    v.oxygen_sat,
    v.oxygen_sat AS oxygen_saturation,
    v.o2_saturation,
    v.notes,
    v.chief_complaint,
    v.nurse_notes,
    v.lmp,
    v.routed_to_specialty_id,
    v.recorded_at,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS patient_name,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username) AS nurse_name,
    s.specialty_name AS routed_to_specialty_name
  FROM vitals v
  LEFT JOIN patients p ON v.patient_id = p.id
  LEFT JOIN users u ON v.nurse_id = u.user_id
  LEFT JOIN specialties s ON v.routed_to_specialty_id = s.specialty_id
`;

const Vital = {
  async create(input) {
    const vital = normalizeInput(input);

    const result = await db.query(
      `INSERT INTO vitals (
         patient_id,
         appointment_id,
         nurse_id,
         blood_pressure,
         heart_rate,
         temperature,
         weight,
         height,
         oxygen_sat,
         o2_saturation,
         notes,
         chief_complaint,
         nurse_notes,
         lmp,
         routed_to_specialty_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
       )
       RETURNING id`,
      [
        vital.patient_id,
        vital.appointment_id,
        vital.nurse_id,
        vital.blood_pressure,
        vital.heart_rate,
        vital.temperature,
        vital.weight,
        vital.height,
        vital.oxygen_sat,
        vital.o2_saturation,
        vital.notes,
        vital.chief_complaint,
        vital.nurse_notes,
        vital.lmp,
        vital.routed_to_specialty_id,
      ]
    );

    return this.findById(result.rows[0].id);
  },

  async findById(id) {
    const result = await db.query(
      `${SELECT_VITAL}
       WHERE v.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByPatient(patientId) {
    const result = await db.query(
      `${SELECT_VITAL}
       WHERE v.patient_id = $1
       ORDER BY v.recorded_at DESC, v.id DESC`,
      [patientId]
    );
    return result.rows;
  },

  async findByAppointment(appointmentId) {
    const result = await db.query(
      `${SELECT_VITAL}
       WHERE v.appointment_id = $1
       ORDER BY v.recorded_at DESC, v.id DESC`,
      [appointmentId]
    );
    return result.rows;
  },

  async findLatestByPatient(patientId) {
    const result = await db.query(
      `${SELECT_VITAL}
       WHERE v.patient_id = $1
       ORDER BY v.recorded_at DESC, v.id DESC
       LIMIT 1`,
      [patientId]
    );
    return result.rows[0] || null;
  },
};

module.exports = Vital;
