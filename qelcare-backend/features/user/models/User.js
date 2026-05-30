const pool = require("../../../config/database");

class User {
 static async getProfile(userId) {
 const result = await pool.query(
 `SELECT
 u.user_id,
 u.username,
 u.email,
 u.first_name,
 u.last_name,
 u.middle_name,
 u.suffix,
 u.phone,
 u.alternate_phone,
 u.gender,
 TO_CHAR(u.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
 u.profile_picture,
 u.status,
 u.failed_login_attempts,
 u.lockout_until,
 u.last_login,
 u.email_changed_at,
 u.password_changed_at,
 u.created_at,
 u.updated_at,
 u.role_id,
 r.role_name AS role,
 u.specialty_id,
 s.specialty_name,
 ua.region_code,
 ua.province_code,
 ua.municipality_code,
 ua.barangay_code,
 ua.address_line
 FROM users u
 LEFT JOIN roles r ON u.role_id = r.role_id
 LEFT JOIN specialties s ON u.specialty_id = s.specialty_id
 LEFT JOIN user_addresses ua ON u.user_id = ua.user_id
 WHERE u.user_id = $1`,
 [userId]
 );
 return result.rows[0] || null;
 }

 static async getAllUsers() {
 const result = await pool.query(
 `SELECT
 u.user_id,
 u.username,
 u.email,
 u.first_name,
 u.last_name,
 u.middle_name,
 u.suffix,
 u.phone,
 u.alternate_phone,
 u.gender,
 u.profile_picture,
 u.status,
 u.failed_login_attempts,
 u.lockout_until,
 u.last_login,
 u.created_at,
 u.updated_at,
 u.role_id,
 r.role_name AS role,
 u.specialty_id,
 s.specialty_name
 FROM users u
 LEFT JOIN roles r ON u.role_id = r.role_id
 LEFT JOIN specialties s ON u.specialty_id = s.specialty_id
 ORDER BY u.created_at DESC`
 );
 return result.rows;
 }

 static async getUserById(userId) {
 const result = await pool.query(
 "SELECT user_id, password, status FROM users WHERE user_id = $1",
 [userId]
 );
 return result.rows[0] || null;
 }

 static async updateProfile(userId, profileData) {
 const client = await pool.connect();
 try {
 await client.query("BEGIN");

 const currentResult = await client.query(
 "SELECT email FROM users WHERE user_id = $1",
 [userId]
 );

 if (currentResult.rows.length === 0) {
 await client.query("ROLLBACK");
 return null;
 }

 const {
 first_name,
 last_name,
 middle_name,
 suffix,
 gender,
 phone,
 alternate_phone,
 email,
 date_of_birth,
 region_code,
 province_code,
 municipality_code,
 barangay_code,
 address_line,
 } = profileData;

 const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
 const currentEmail = currentResult.rows[0].email || null;

 if (normalizedEmail && normalizedEmail !== String(currentEmail || "").toLowerCase()) {
 const duplicate = await client.query(
 "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2",
 [normalizedEmail, userId]
 );

 if (duplicate.rows.length > 0) {
 const error = new Error("Email is already used by another account");
 error.status = 409;
 throw error;
 }
 }

 await client.query(
 `UPDATE users
 SET first_name = $1,
 last_name = $2,
 middle_name = $3,
 suffix = $4,
 gender = $5,
 phone = $6,
 alternate_phone = $7,
 email = COALESCE($8, email),
 date_of_birth = $9,
 email_changed_at = CASE
 WHEN $8::text IS NOT NULL AND LOWER(email) <> LOWER($8::text) THEN NOW()
 ELSE email_changed_at
 END,
 updated_at = NOW()
 WHERE user_id = $10`,
 [
 first_name ? String(first_name).trim() : null,
 last_name ? String(last_name).trim() : null,
 middle_name ? String(middle_name).trim() : null,
 suffix ? String(suffix).trim() : null,
 gender || null,
 phone ? String(phone).trim() : null,
 alternate_phone ? String(alternate_phone).trim() : null,
 normalizedEmail,
 date_of_birth || null,
 userId,
 ]
 );

 await client.query(
 `INSERT INTO user_addresses
 (user_id, region_code, province_code, municipality_code, barangay_code, address_line)
 VALUES ($1, $2, $3, $4, $5, $6)
 ON CONFLICT (user_id) DO UPDATE SET
 region_code = EXCLUDED.region_code,
 province_code = EXCLUDED.province_code,
 municipality_code = EXCLUDED.municipality_code,
 barangay_code = EXCLUDED.barangay_code,
 address_line = EXCLUDED.address_line,
 updated_at = NOW()`,
 [
 userId,
 region_code ? String(region_code).trim() : null,
 province_code ? String(province_code).trim() : null,
 municipality_code ? String(municipality_code).trim() : null,
 barangay_code ? String(barangay_code).trim() : null,
 address_line ? String(address_line).trim() : null,
 ]
 );

 await client.query("COMMIT");
 return await User.getProfile(userId);
 } catch (error) {
 await client.query("ROLLBACK");
 throw error;
 } finally {
 client.release();
 }
 }

 static async updateProfilePicture(userId, profile_picture) {
 const result = await pool.query(
 `UPDATE users
 SET profile_picture = $1, updated_at = NOW()
 WHERE user_id = $2
 RETURNING user_id, profile_picture, updated_at`,
 [profile_picture, userId]
 );
 return result.rows[0] || null;
 }

 static async createUser({
 username,
 email,
 password,
 first_name,
 last_name,
 role_id,
 phone = null,
 gender = null,
 specialty_id = null,
 date_of_birth = null,
 middle_name = null,
 suffix = null,
 alternate_phone = null,
 }) {
 const bcrypt = require("bcrypt");
 const hashedPassword = await bcrypt.hash(password, 12);

 const result = await pool.query(
 `INSERT INTO users
 (username, email, password, first_name, last_name, middle_name, suffix, role_id, phone, alternate_phone, gender, date_of_birth, specialty_id, status)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'verified')
 RETURNING
 user_id,
 username,
 email,
 first_name,
 last_name,
 middle_name,
 suffix,
 phone,
 alternate_phone,
 gender,
 TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
 profile_picture,
 role_id,
 specialty_id,
 status,
 created_at,
 updated_at`,
 [
 username,
 email,
 hashedPassword,
 first_name,
 last_name,
 middle_name || null,
 suffix || null,
 role_id,
 phone || null,
 alternate_phone || null,
 gender || null,
 date_of_birth || null,
 specialty_id || null,
 ]
 );
 return result.rows[0];
 }

 static async registerPatientAccount({
 username,
 email,
 password,
 first_name,
 last_name,
 date_of_birth = null,
 phone = null,
 gender = null,
 }) {
 const bcrypt = require("bcrypt");
 const client = await pool.connect();

 try {
 await client.query("BEGIN");

 const roleResult = await client.query(
 "SELECT role_id FROM roles WHERE role_name = 'Patient' LIMIT 1"
 );

 if (roleResult.rowCount === 0) {
 const error = new Error("Patient role is not configured");
 error.status = 500;
 throw error;
 }

 const duplicate = await client.query(
 "SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1",
 [username, email]
 );

 if (duplicate.rowCount > 0) {
 const error = new Error("Username or email already taken");
 error.status = 409;
 throw error;
 }

 const hashedPassword = await bcrypt.hash(password, 12);
 const roleId = roleResult.rows[0].role_id;

 const userResult = await client.query(
 `INSERT INTO users
 (username, email, password, first_name, last_name, phone, gender, date_of_birth, role_id, status)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'verified')
 RETURNING
 user_id,
 username,
 email,
 first_name,
 last_name,
 phone,
 gender,
 TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
 role_id,
 status,
 created_at,
 updated_at`,
 [
 username,
 email,
 hashedPassword,
 first_name,
 last_name,
 phone || null,
 gender || null,
 date_of_birth || null,
 roleId,
 ]
 );

 const user = userResult.rows[0];
 const patientResult = await client.query(
 `INSERT INTO patients (
 user_id,
 name,
 first_name,
 last_name,
 date_of_birth,
 gender,
 phone,
 contact,
 email,
 is_active,
 created_at,
 updated_at
 )
 VALUES (
 $1,
 TRIM(CONCAT_WS(' ', $2::text, $3::text)),
 $2,
 $3,
 $4,
 $5,
 $6,
 $6,
 $7,
 TRUE,
 NOW(),
 NOW()
 )
 ON CONFLICT (user_id) DO UPDATE SET
 name = EXCLUDED.name,
 first_name = EXCLUDED.first_name,
 last_name = EXCLUDED.last_name,
 date_of_birth = EXCLUDED.date_of_birth,
 gender = EXCLUDED.gender,
 phone = EXCLUDED.phone,
 contact = EXCLUDED.contact,
 email = EXCLUDED.email,
 is_active = TRUE,
 updated_at = NOW()
 RETURNING *`,
 [
 user.user_id,
 first_name,
 last_name,
 date_of_birth || null,
 gender || null,
 phone || null,
 email,
 ]
 );

 await client.query("COMMIT");
 return { user, patient: patientResult.rows[0] };
 } catch (error) {
 await client.query("ROLLBACK");
 throw error;
 } finally {
 client.release();
 }
 }

 static async updateStatus(userId, status) {
 const result = await pool.query(
 `UPDATE users
 SET status = $1, updated_at = NOW()
 WHERE user_id = $2
 RETURNING user_id, status`,
 [status, userId]
 );
 return result.rows[0] || null;
 }

 static async updateRole(userId, role_id) {
 const result = await pool.query(
 `UPDATE users
 SET role_id = $1, updated_at = NOW()
 WHERE user_id = $2
 RETURNING user_id, role_id`,
 [role_id, userId]
 );
 return result.rows[0] || null;
 }

 static async updateAdminDetails(userId, { phone = undefined, gender = undefined, specialty_id = undefined }) {
 const phoneProvided = phone !== undefined;
 const genderProvided = gender !== undefined;
 const specialtyProvided = specialty_id !== undefined;
 const result = await pool.query(
 `UPDATE users
 SET phone = CASE WHEN $1::boolean THEN $2 ELSE phone END,
 gender = CASE WHEN $3::boolean THEN $4 ELSE gender END,
 specialty_id = CASE WHEN $5::boolean THEN $6::int ELSE specialty_id END,
 updated_at = NOW()
 WHERE user_id = $7
 RETURNING user_id, phone, gender, specialty_id, updated_at`,
 [
 phoneProvided,
 phone || null,
 genderProvided,
 gender || null,
 specialtyProvided,
 specialty_id || null,
 userId,
 ]
 );
 return result.rows[0] || null;
 }
}

module.exports = User;
