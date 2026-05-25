const db = require("../../../config/database");

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

function fullName({ first_name, last_name, name }) {
  const joined = [first_name, last_name].filter(Boolean).join(" ").trim();
  return joined || String(name || "").trim();
}

function normalizePatientInput(input = {}) {
  const parsed = splitName(input.name);
  const first_name = String(input.first_name || parsed.first_name || "").trim();
  const last_name = String(input.last_name || parsed.last_name || "").trim();
  const phone = input.phone || input.contact || null;

  return {
    user_id: input.user_id || null,
    first_name,
    last_name,
    middle_name: input.middle_name || null,
    suffix: input.suffix || null,
    date_of_birth: input.date_of_birth || null,
    gender: input.gender || null,
    blood_type: input.blood_type || null,
    phone,
    contact: phone,
    email: input.email || null,
    address: input.address || null,
    emergency_contact_name: input.emergency_contact_name || null,
    emergency_contact_phone: input.emergency_contact_phone || null,
    emergency_contact_relation: input.emergency_contact_relation || null,
    philhealth_no: input.philhealth_no || null,
    senior_pwd_id: input.senior_pwd_id || null,
    age: input.age === "" || input.age === undefined ? null : input.age,
    name: fullName({ first_name, last_name, name: input.name }),
    created_by: input.created_by || null,
  };
}

const Patient = {
  async create(input) {
    const p = normalizePatientInput(input);

    const result = await db.query(
      `INSERT INTO patients (
         user_id, name, age, contact, address,
         first_name, last_name, middle_name, suffix,
         date_of_birth, gender, blood_type, phone, email,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
         philhealth_no, senior_pwd_id, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,$13,$14,
         $15,$16,$17,
         $18,$19,$20
       )
       RETURNING *`,
      [
        p.user_id,
        p.name,
        p.age,
        p.contact,
        p.address,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.suffix,
        p.date_of_birth,
        p.gender,
        p.blood_type,
        p.phone,
        p.email,
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.emergency_contact_relation,
        p.philhealth_no,
        p.senior_pwd_id,
        p.created_by,
      ]
    );

    return result.rows[0];
  },

  async findAll({ search = "", is_active = null } = {}) {
    const params = [`%${search}%`];
    let where = `WHERE (
      p.first_name ILIKE $1 OR
      p.last_name ILIKE $1 OR
      p.name ILIKE $1 OR
      p.phone ILIKE $1 OR
      p.contact ILIKE $1 OR
      p.email ILIKE $1
    )`;

    if (is_active !== null) {
      params.push(is_active);
      where += ` AND p.is_active = $${params.length}`;
    }

    const result = await db.query(
      `SELECT
         p.*,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS display_name,
         u.username,
         u.email AS user_email,
         r.role_name
       FROM patients p
       LEFT JOIN users u ON p.user_id = u.user_id
       LEFT JOIN roles r ON u.role_id = r.role_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT
         p.*,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS display_name,
         u.username,
         u.email AS user_email,
         r.role_name
       FROM patients p
       LEFT JOIN users u ON p.user_id = u.user_id
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByUserId(userId) {
    const result = await db.query(
      `SELECT
         p.*,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.name) AS display_name
       FROM patients p
       WHERE p.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async update(id, input) {
    const p = normalizePatientInput(input);

    const result = await db.query(
      `UPDATE patients SET
         name = $1,
         age = $2,
         contact = $3,
         address = $4,
         first_name = $5,
         last_name = $6,
         middle_name = $7,
         suffix = $8,
         date_of_birth = $9,
         gender = $10,
         blood_type = $11,
         phone = $12,
         email = $13,
         emergency_contact_name = $14,
         emergency_contact_phone = $15,
         emergency_contact_relation = $16,
         philhealth_no = $17,
         senior_pwd_id = $18,
         updated_at = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        p.name,
        p.age,
        p.contact,
        p.address,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.suffix,
        p.date_of_birth,
        p.gender,
        p.blood_type,
        p.phone,
        p.email,
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.emergency_contact_relation,
        p.philhealth_no,
        p.senior_pwd_id,
        id,
      ]
    );

    return result.rows[0] || null;
  },

  async setActive(id, is_active) {
    const result = await db.query(
      `UPDATE patients
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [is_active, id]
    );
    return result.rows[0] || null;
  },
};

module.exports = Patient;
