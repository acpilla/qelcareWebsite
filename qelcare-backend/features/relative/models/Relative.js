const db = require("../../../config/database");

const SELECT = `
  relative_id, owner_user_id, first_name, last_name, relationship,
  date_of_birth, age, gender, phone, email, created_at, updated_at
`;

function clean(value, max) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

// Capitalize each word so "kelly celocia" is stored as "Kelly Celocia".
function toTitleCase(value) {
  const text = clean(value, 200);
  if (!text) return null;
  return text.toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

function buildFields(input) {
  const first = toTitleCase(input.first_name);
  const last = toTitleCase(input.last_name);
  const relationship = clean(input.relationship, 80);
  if (!first || !last || !relationship) {
    throw { statusCode: 400, message: "First name, last name, and relationship are required." };
  }
  const email = clean(input.email, 150);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { statusCode: 400, message: "Relative email is invalid." };
  }
  const ageNum = parseInt(input.age, 10);
  return {
    first_name: first.slice(0, 80),
    last_name: last.slice(0, 80),
    relationship,
    date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date_of_birth || "")) ? input.date_of_birth : null,
    age: Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130 ? ageNum : null,
    gender: clean(input.gender, 20),
    phone: clean(input.phone, 30),
    email,
  };
}

const Relative = {
  async listByOwner(ownerUserId) {
    const result = await db.query(
      `SELECT ${SELECT} FROM patient_relatives WHERE owner_user_id = $1 ORDER BY first_name, last_name`,
      [ownerUserId]
    );
    return result.rows;
  },

  async create(ownerUserId, input = {}) {
    const f = buildFields(input);
    const result = await db.query(
      `INSERT INTO patient_relatives
         (owner_user_id, first_name, last_name, relationship, date_of_birth, age, gender, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${SELECT}`,
      [ownerUserId, f.first_name, f.last_name, f.relationship, f.date_of_birth, f.age, f.gender, f.phone, f.email]
    );
    return result.rows[0];
  },

  async updateOwned(relativeId, ownerUserId, input = {}) {
    const f = buildFields(input);
    const result = await db.query(
      `UPDATE patient_relatives
         SET first_name = $1, last_name = $2, relationship = $3, date_of_birth = $4,
             age = $5, gender = $6, phone = $7, email = $8, updated_at = NOW()
       WHERE relative_id = $9 AND owner_user_id = $10
       RETURNING ${SELECT}`,
      [f.first_name, f.last_name, f.relationship, f.date_of_birth, f.age, f.gender, f.phone, f.email, relativeId, ownerUserId]
    );
    return result.rows[0] || null;
  },

  async deleteOwned(relativeId, ownerUserId) {
    const result = await db.query(
      `DELETE FROM patient_relatives WHERE relative_id = $1 AND owner_user_id = $2 RETURNING relative_id`,
      [relativeId, ownerUserId]
    );
    return result.rows[0] || null;
  },
};

module.exports = Relative;
