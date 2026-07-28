import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../Layout/MainLayout";
import { API_URL, authFetch, getUserRole, logout } from "../../../utils/auth";

const EMPTY_PROFILE = {
 first_name: "",
 last_name: "",
 middle_name: "",
 suffix: "",
 email: "",
 phone: "",
 alternate_phone: "",
 gender: "",
 date_of_birth: "",
 region_code: "",
 province_code: "",
 municipality_code: "",
 barangay_code: "",
 address_line: "",
};

const TABS = [
 { id: "profile", label: "Profile" },
 { id: "security", label: "Security" },
];

const GENDERS = ["Male", "Female", "Other"];

function fullName(user) {
 const value = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
 return value || user?.username || "User";
}

function initials(name) {
 return String(name || "U").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDateTime(value) {
 if (!value) return "Not recorded";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "Not recorded";
 return new Intl.DateTimeFormat("en-PH", {
 month: "short",
 day: "2-digit",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 }).format(date);
}

function normalizeImageUrl(url, version) {
 if (!url) return "";
 const value = String(url).trim();
 if (!value) return "";
 const absolute = value.startsWith("http") ? value : `${API_URL}${value.startsWith("/") ? "" : "/"}${value}`;
 const separator = absolute.includes("?") ? "&" : "?";
 return `${absolute}${separator}v=${version}`;
}

function mapProfileToForm(profile) {
 return {
 first_name: profile?.first_name || "",
 last_name: profile?.last_name || "",
 middle_name: profile?.middle_name || "",
 suffix: profile?.suffix || "",
 email: profile?.email || "",
 phone: profile?.phone || "",
 alternate_phone: profile?.alternate_phone || "",
 gender: profile?.gender || "",
 date_of_birth: profile?.date_of_birth || "",
 region_code: profile?.region_code || "",
 province_code: profile?.province_code || "",
 municipality_code: profile?.municipality_code || "",
 barangay_code: profile?.barangay_code || "",
 address_line: profile?.address_line || "",
 };
}

function syncStoredUser(profile) {
 try {
 const stored = JSON.parse(localStorage.getItem("user") || "{}");
 localStorage.setItem(
 "user",
 JSON.stringify({...stored,
 user_id: profile.user_id,
 username: profile.username,
 role: profile.role,
 first_name: profile.first_name,
 last_name: profile.last_name,
 email: profile.email,
 profile_picture: profile.profile_picture || null,
 })
 );
 window.dispatchEvent(new Event("qelcare:user-updated"));
 } catch {
 localStorage.setItem(
 "user",
 JSON.stringify({
 user_id: profile.user_id,
 username: profile.username,
 role: profile.role,
 first_name: profile.first_name,
 last_name: profile.last_name,
 email: profile.email,
 profile_picture: profile.profile_picture || null,
 })
 );
 }
}

function Avatar({ user, imageVersion, size = 82 }) {
 const [failed, setFailed] = useState(false);
 const name = fullName(user);
 const src = failed ? "" : normalizeImageUrl(user?.profile_picture, imageVersion);

 useEffect(() => {
 setFailed(false);
 }, [user?.profile_picture, imageVersion]);

 return (
 <div className="ps-avatar" style={{ width: size, height: size }}>
 {src ? (
 <img src={src} alt={`${name} profile`} onError={() => setFailed(true)} />
 ) : (
 <span>{initials(name)}</span>
 )}
 </div>
 );
}

// App-wide phone rule (matches the backend + registration): PH mobile
// 09XXXXXXXXX, +639XXXXXXXXX, or international +<10-14 digits>. Optional field ->
// empty is valid. Returns an inline error string, or "" when valid.
function validatePhone(value) {
 const raw = String(value || "").trim();
 if (!raw) return "";
 if (raw.length > 20) return "Phone must be 20 characters or less.";
 const cleaned = raw.replace(/[\s\-()]/g, "");
 if (!/^(09\d{9}|\+639\d{9}|\+\d{10,14})$/.test(cleaned)) {
 return "Enter a valid phone, e.g. 09XXXXXXXXX or +639XXXXXXXXX.";
 }
 return "";
}

function Field({ label, name, value, onChange, type = "text", placeholder = "", disabled = false, error = "" }) {
 return (
 <label className="ps-field">
 <span>{label}</span>
 <input
 type={type}
 name={name}
 value={value || ""}
 onChange={onChange}
 placeholder={placeholder}
 disabled={disabled}
 aria-invalid={error ? "true" : undefined}
 style={error ? { borderColor: "#e2867f", background: "#fff7f7" } : undefined}
 />
 {error && <small style={{ color: "#b63342", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{error}</small>}
 </label>
 );
}

function ReadOnly({ label, value }) {
 return (
 <div className="ps-readonly">
 <span>{label}</span>
 <strong>{value || "Not recorded"}</strong>
 </div>
 );
}

function PasswordInput({ label, name, value, onChange }) {
 const [visible, setVisible] = useState(false);
 return (
 <label className="ps-field ps-password">
 <span>{label}</span>
 <input
 type={visible ? "text" : "password"}
 name={name}
 value={value}
 onChange={onChange}
 autoComplete="new-password"
 />
 <button type="button" onClick={() => setVisible((current) => !current)}>
 {visible ? "Hide" : "Show"}
 </button>
 </label>
 );
}

function passwordChecks(password) {
 return {
 length: password.length >= 8,
 uppercase: /[A-Z]/.test(password),
 lowercase: /[a-z]/.test(password),
 number: /\d/.test(password),
 special: /[@$!%*?&#]/.test(password),
 };
}

export default function ProfileSettings() {
 const [activeTab, setActiveTab] = useState("profile");
 const [profile, setProfile] = useState(null);
 const [form, setForm] = useState(EMPTY_PROFILE);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [editing, setEditing] = useState(false);
 const [alert, setAlert] = useState(null);
 const [fieldErrors, setFieldErrors] = useState({});
 const [imageVersion, setImageVersion] = useState(Date.now());
 const [passwordForm, setPasswordForm] = useState({
 currentPassword: "",
 newPassword: "",
 confirmPassword: "",
 });
 const [passwordSaving, setPasswordSaving] = useState(false);

 const showAlert = useCallback((type, message) => {
 setAlert({ type, message });
 window.clearTimeout(showAlert.timer);
 showAlert.timer = window.setTimeout(() => setAlert(null), 3500);
 }, []);

 const loadProfile = useCallback(async () => {
 setLoading(true);
 try {
 const res = await authFetch("/users/me");
 if (!res) return;
 const data = await res.json();
 if (!res.ok || data.success === false) {
 throw new Error(data.message || "Failed to load profile.");
 }

 const nextProfile = data.data || null;
 setProfile(nextProfile);
 setForm(mapProfileToForm(nextProfile));
 setImageVersion(Date.now());
 if (nextProfile) syncStoredUser(nextProfile);
 } catch (error) {
 showAlert("error", error.message || "Failed to load profile.");
 } finally {
 setLoading(false);
 }
 }, [showAlert]);

 useEffect(() => {
 loadProfile();
 }, [loadProfile]);

 const displayName = useMemo(() => fullName(profile), [profile]);
 const currentRole = profile?.role || getUserRole() || "User";
 const profileSubtitle = `Manage your ${currentRole.toLowerCase()} account details`;
 const checks = useMemo(() => passwordChecks(passwordForm.newPassword), [passwordForm.newPassword]);
 const passwordValid = Object.values(checks).every(Boolean);

 function handleFormChange(event) {
 const { name, value } = event.target;
 setForm((current) => ({...current, [name]: value }));
 setFieldErrors((prev) => (prev[name] ? {...prev, [name]: "" } : prev));
 }

 function handlePasswordChange(event) {
 const { name, value } = event.target;
 setPasswordForm((current) => ({...current, [name]: value }));
 }

 async function saveProfile() {
 if (!form.first_name.trim() || !form.last_name.trim()) {
 showAlert("error", "First name and last name are required.");
 return;
 }

 if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
 showAlert("error", "Enter a valid email address.");
 return;
 }

 const phoneErr = validatePhone(form.phone);
 const altErr = validatePhone(form.alternate_phone);
 if (phoneErr || altErr) {
 setFieldErrors({ phone: phoneErr, alternate_phone: altErr });
 showAlert("error", phoneErr || altErr);
 return;
 }
 setFieldErrors({});

 setSaving(true);
 try {
 const res = await authFetch("/users/me", {
 method: "PUT",
 body: JSON.stringify({...form,
 email: form.email.trim().toLowerCase(),
 }),
 });
 if (!res) return;
 const data = await res.json();
 if (!res.ok || data.success === false) {
 throw new Error(data.message || "Failed to save profile.");
 }

 const updated = data.data;
 setProfile(updated);
 setForm(mapProfileToForm(updated));
 syncStoredUser(updated);
 setEditing(false);
 showAlert("success", "Profile updated.");
 } catch (error) {
 showAlert("error", error.message || "Failed to save profile.");
 } finally {
 setSaving(false);
 }
 }

 async function uploadProfilePicture(event) {
 const file = event.target.files?.[0];
 event.target.value = "";
 if (!file) return;

 const allowed = ["image/jpeg", "image/png", "image/webp"];
 if (!allowed.includes(file.type)) {
 showAlert("error", "Only JPG, PNG, and WEBP images are allowed.");
 return;
 }

 if (file.size > 5 * 1024 * 1024) {
 showAlert("error", "Profile image must be 5MB or smaller.");
 return;
 }

 setUploading(true);
 try {
 const body = new FormData();
 body.append("profilePicture", file);

 const token = localStorage.getItem("token");
 const res = await fetch(`${API_URL}/users/profile-picture`, {
 method: "POST",
 headers: token ? { Authorization: `Bearer ${token}` } : {},
 body,
 });
 const data = await res.json();
 if (!res.ok || data.success === false) {
 throw new Error(data.message || "Upload failed.");
 }

 const nextProfile = {...profile,
 profile_picture: data.url || data.data?.profile_picture,
 };
 setProfile(nextProfile);
 setImageVersion(Date.now());
 syncStoredUser(nextProfile);
 await loadProfile();
 showAlert("success", "Profile picture updated.");
 } catch (error) {
 showAlert("error", error.message || "Upload failed.");
 } finally {
 setUploading(false);
 }
 }

 async function changePassword() {
 if (!passwordForm.currentPassword) {
 showAlert("error", "Current password is required.");
 return;
 }
 if (!passwordValid) {
 showAlert("error", "New password does not meet the requirements.");
 return;
 }
 if (passwordForm.newPassword !== passwordForm.confirmPassword) {
 showAlert("error", "New password and confirmation do not match.");
 return;
 }

 setPasswordSaving(true);
 try {
 const res = await authFetch("/auth/password/change", {
 method: "POST",
 body: JSON.stringify({
 currentPassword: passwordForm.currentPassword,
 newPassword: passwordForm.newPassword,
 }),
 });
 if (!res) return;
 const data = await res.json();
 if (!res.ok || data.success === false) {
 throw new Error(data.message || "Password change failed.");
 }

 showAlert("success", "Password changed. Please log in again.");
 window.setTimeout(() => logout(), 1200);
 } catch (error) {
 showAlert("error", error.message || "Password change failed.");
 } finally {
 setPasswordSaving(false);
 }
 }

 function cancelEdit() {
 setForm(mapProfileToForm(profile));
 setEditing(false);
 }

 return (
 <MainLayout pageTitle="Profile Settings" pageSubtitle={profileSubtitle}>
 <div className="ps-page">
 {alert && <div className={`ps-alert ${alert.type}`}>{alert.message}</div>}

 <section className="ps-profile-card">
 <div className="ps-profile-main">
 <div className="ps-avatar-wrap">
 <Avatar user={profile} imageVersion={imageVersion} />
 <label className={`ps-camera ${uploading ? "disabled" : ""}`} title="Upload profile photo">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
 <circle cx="12" cy="13" r="4" />
 </svg>
 <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadProfilePicture} disabled={uploading} />
 </label>
 </div>
 <div>
 <h2>{loading ? "Loading..." : displayName}</h2>
 <p>{profile?.email || "No email recorded"}</p>
 <div className="ps-chip-row">
 <span>{profile?.role || "User"}</span>
 <span>{profile?.status || "unknown"}</span>
 {profile?.specialty_name && <span>{profile.specialty_name}</span>}
 </div>
 </div>
 </div>
 <div className="ps-tabs">
 {TABS.map((tab) => (
 <button
 key={tab.id}
 type="button"
 className={activeTab === tab.id ? "active" : ""}
 onClick={() => setActiveTab(tab.id)}
 >
 {tab.label}
 </button>
 ))}
 </div>
 </section>

 {activeTab === "profile" && (
 <section className="ps-panel">
 <div className="ps-panel-head">
 <div>
 <h3>Personal Information</h3>
 <p>Synced with your account record and admin user list.</p>
 </div>
 {!editing ? (
 <button type="button" className="ps-secondary" onClick={() => setEditing(true)}>
 Edit Profile
 </button>
 ) : (
 <div className="ps-actions">
 <button type="button" className="ps-secondary" onClick={cancelEdit} disabled={saving}>
 Cancel
 </button>
 <button type="button" className="ps-primary" onClick={saveProfile} disabled={saving}>
 {saving ? "Saving..." : "Save Changes"}
 </button>
 </div>
 )}
 </div>

 <div className="ps-grid">
 <Field label="First Name" name="first_name" value={form.first_name} onChange={handleFormChange} disabled={!editing} />
 <Field label="Last Name" name="last_name" value={form.last_name} onChange={handleFormChange} disabled={!editing} />
 <Field label="Middle Name" name="middle_name" value={form.middle_name} onChange={handleFormChange} disabled={!editing} />
 <Field label="Suffix" name="suffix" value={form.suffix} onChange={handleFormChange} disabled={!editing} placeholder="Jr., Sr., III" />
 <Field label="Email" name="email" value={form.email} onChange={handleFormChange} disabled={!editing} type="email" />
 <Field label="Phone" name="phone" value={form.phone} onChange={handleFormChange} disabled={!editing} error={fieldErrors.phone} />
 <Field label="Alternate Phone" name="alternate_phone" value={form.alternate_phone} onChange={handleFormChange} disabled={!editing} error={fieldErrors.alternate_phone} />
 <label className="ps-field">
 <span>Gender</span>
 <select name="gender" value={form.gender || ""} onChange={handleFormChange} disabled={!editing}>
 <option value="">Not set</option>
 {GENDERS.map((gender) => (
 <option key={gender} value={gender}>
 {gender}
 </option>
 ))}
 </select>
 </label>
 <Field label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={handleFormChange} disabled={!editing} type="date" />
 <Field label="Address Line" name="address_line" value={form.address_line} onChange={handleFormChange} disabled={!editing} />
 <Field label="Region Code" name="region_code" value={form.region_code} onChange={handleFormChange} disabled={!editing} />
 <Field label="Province Code" name="province_code" value={form.province_code} onChange={handleFormChange} disabled={!editing} />
 <Field label="Municipality Code" name="municipality_code" value={form.municipality_code} onChange={handleFormChange} disabled={!editing} />
 <Field label="Barangay Code" name="barangay_code" value={form.barangay_code} onChange={handleFormChange} disabled={!editing} />
 </div>
 </section>
 )}

 {activeTab === "security" && (
 <div className="ps-security-layout">
 <section className="ps-panel">
 <div className="ps-panel-head">
 <div>
 <h3>Account Status</h3>
 <p>Real account security fields from the backend.</p>
 </div>
 </div>
 <div className="ps-readonly-grid">
 <ReadOnly label="Username" value={profile?.username} />
 <ReadOnly label="Role" value={profile?.role} />
 <ReadOnly label="Status" value={profile?.status} />
 <ReadOnly label="User ID" value={profile?.user_id ? `#${profile.user_id}` : ""} />
 <ReadOnly label="Last Login" value={formatDateTime(profile?.last_login)} />
 <ReadOnly label="Password Changed" value={formatDateTime(profile?.password_changed_at)} />
 <ReadOnly label="Email Changed" value={formatDateTime(profile?.email_changed_at)} />
 <ReadOnly label="Failed Login Attempts" value={String(profile?.failed_login_attempts || 0)} />
 <ReadOnly label="Lockout Until" value={formatDateTime(profile?.lockout_until)} />
 <ReadOnly label="Created" value={formatDateTime(profile?.created_at)} />
 </div>
 </section>

 <section className="ps-panel">
 <div className="ps-panel-head">
 <div>
 <h3>Change Password</h3>
 <p>You will be logged out after a successful password change.</p>
 </div>
 </div>
 <div className="ps-password-form">
 <PasswordInput label="Current Password" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordChange} />
 <PasswordInput label="New Password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} />
 <div className="ps-checks">
 {[
 ["length", "8+ characters"],
 ["uppercase", "Uppercase"],
 ["lowercase", "Lowercase"],
 ["number", "Number"],
 ["special", "Special character"],
 ].map(([key, label]) => (
 <span key={key} className={checks[key] ? "ok" : ""}>
 {label}
 </span>
 ))}
 </div>
 <PasswordInput label="Confirm New Password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} />
 <button type="button" className="ps-primary wide" onClick={changePassword} disabled={passwordSaving}>
 {passwordSaving ? "Updating..." : "Update Password"}
 </button>
 </div>
 </section>
 </div>
 )}
 </div>

 <style>{`.ps-page {
 display: flex;
 flex-direction: column;
 gap: 18px;
 color: #0f2744;
 }.ps-alert {
 padding: 12px 14px;
 border-radius: 10px;
 border: 1px solid;
 font-size: 13px;
 font-weight: 800;
 }.ps-alert.success {
 background: #eaf6ef;
 border-color: #bfe4cc;
 color: #1f7a52;
 }.ps-alert.error {
 background: #fff0f0;
 border-color: #ffd1d1;
 color: #9d2f2f;
 }.ps-profile-card,.ps-panel {
 background: #fff;
 border: 1px solid #e4ecf5;
 border-radius: 16px;
 box-shadow: 0 4px 18px rgba(15, 39, 68, 0.06);
 }.ps-profile-card {
 padding: 20px;
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 18px;
 }.ps-profile-main {
 display: flex;
 align-items: center;
 gap: 18px;
 min-width: 0;
 }.ps-avatar-wrap {
 position: relative;
 flex: 0 0 auto;
 }.ps-avatar {
 border-radius: 50%;
 overflow: hidden;
 background: linear-gradient(135deg, #0f2744, #1f7a6f);
 border: 3px solid #e8eef6;
 display: grid;
 place-items: center;
 color: #fff;
 font-weight: 900;
 font-size: 25px;
 }.ps-avatar img {
 width: 100%;
 height: 100%;
 object-fit: cover;
 display: block;
 }.ps-camera {
 position: absolute;
 right: -2px;
 bottom: -2px;
 width: 32px;
 height: 32px;
 border-radius: 50%;
 background: #163a6b;
 color: #fff;
 border: 3px solid #fff;
 display: grid;
 place-items: center;
 cursor: pointer;
 }.ps-camera.disabled {
 opacity: 0.55;
 cursor: not-allowed;
 }.ps-camera input {
 display: none;
 }.ps-profile-main h2 {
 margin: 0;
 font-size: 22px;
 font-weight: 900;
 color: #0f2744;
 }.ps-profile-main p {
 margin: 4px 0 10px;
 font-size: 13px;
 color: #66778a;
 }.ps-chip-row {
 display: flex;
 flex-wrap: wrap;
 gap: 7px;
 }.ps-chip-row span {
 border-radius: 999px;
 background: #eef3fb;
 color: #163a6b;
 padding: 5px 10px;
 font-size: 12px;
 font-weight: 850;
 text-transform: capitalize;
 }.ps-tabs {
 display: flex;
 gap: 8px;
 padding: 5px;
 border: 1px solid #e4ecf5;
 border-radius: 12px;
 background: #f8fbfd;
 }.ps-tabs button {
 height: 36px;
 border: 0;
 border-radius: 9px;
 background: transparent;
 color: #66778a;
 font-family: inherit;
 font-size: 13px;
 font-weight: 850;
 padding: 0 14px;
 cursor: pointer;
 }.ps-tabs button.active {
 background: #163a6b;
 color: #fff;
 }.ps-panel {
 overflow: hidden;
 }.ps-panel-head {
 padding: 18px 20px;
 border-bottom: 1px solid #eef3f9;
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 14px;
 }.ps-panel-head h3 {
 margin: 0;
 font-size: 17px;
 font-weight: 900;
 color: #0f2744;
 }.ps-panel-head p {
 margin: 4px 0 0;
 font-size: 13px;
 color: #7c8a9a;
 }.ps-actions {
 display: flex;
 gap: 9px;
 }.ps-primary,.ps-secondary {
 height: 38px;
 border-radius: 10px;
 padding: 0 14px;
 font-family: inherit;
 font-size: 13px;
 font-weight: 850;
 cursor: pointer;
 }.ps-primary {
 border: 1px solid #163a6b;
 background: #163a6b;
 color: #fff;
 }.ps-secondary {
 border: 1px solid #dce6f1;
 background: #fff;
 color: #163a6b;
 }.ps-primary:disabled,.ps-secondary:disabled {
 opacity: 0.55;
 cursor: not-allowed;
 }.ps-grid {
 padding: 20px;
 display: grid;
 grid-template-columns: repeat(2, minmax(0, 1fr));
 gap: 15px;
 }.ps-field {
 display: flex;
 flex-direction: column;
 gap: 6px;
 min-width: 0;
 }.ps-field span,.ps-readonly span {
 font-size: 11px;
 text-transform: uppercase;
 letter-spacing: 0;
 color: #7c8a9a;
 font-weight: 900;
 }.ps-field input,.ps-field select {
 width: 100%;
 height: 40px;
 border: 1px solid #dce6f1;
 border-radius: 10px;
 background: #fff;
 color: #17212b;
 font-family: inherit;
 font-size: 13px;
 padding: 0 11px;
 outline: none;
 }.ps-field input:disabled,.ps-field select:disabled {
 background: #f8fbfd;
 color: #405166;
 opacity: 1;
 }.ps-field input:focus,.ps-field select:focus {
 border-color: #163a6b;
 box-shadow: 0 0 0 3px rgba(22, 58, 107, 0.1);
 }.ps-security-layout {
 display: grid;
 grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
 gap: 18px;
 align-items: start;
 }.ps-readonly-grid {
 padding: 20px;
 display: grid;
 grid-template-columns: repeat(2, minmax(0, 1fr));
 gap: 12px;
 }.ps-readonly {
 border: 1px solid #eef3f9;
 background: #fbfdff;
 border-radius: 12px;
 padding: 12px;
 min-width: 0;
 }.ps-readonly span {
 display: block;
 margin-bottom: 6px;
 }.ps-readonly strong {
 display: block;
 font-size: 13px;
 color: #0f2744;
 overflow-wrap: anywhere;
 }.ps-password-form {
 padding: 20px;
 display: flex;
 flex-direction: column;
 gap: 13px;
 }.ps-password {
 position: relative;
 }.ps-password input {
 padding-right: 64px;
 }.ps-password button {
 position: absolute;
 right: 8px;
 bottom: 5px;
 height: 30px;
 border: 0;
 background: transparent;
 color: #163a6b;
 font-family: inherit;
 font-size: 12px;
 font-weight: 850;
 cursor: pointer;
 }.ps-checks {
 display: flex;
 gap: 7px;
 flex-wrap: wrap;
 }.ps-checks span {
 border-radius: 999px;
 padding: 5px 9px;
 background: #f2f5f8;
 color: #7c8a9a;
 font-size: 11px;
 font-weight: 850;
 }.ps-checks span.ok {
 background: #eaf6ef;
 color: #1f7a52;
 }.ps-primary.wide {
 width: 100%;
 height: 42px;
 }

 @media (max-width: 980px) {.ps-profile-card,.ps-panel-head {
 align-items: stretch;
 flex-direction: column;
 }.ps-tabs,.ps-actions {
 width: 100%;
 }.ps-tabs button,.ps-actions button,.ps-secondary,.ps-primary {
 flex: 1;
 }.ps-security-layout {
 grid-template-columns: 1fr;
 }
 }

 @media (max-width: 700px) {.ps-profile-main {
 align-items: flex-start;
 }.ps-grid,.ps-readonly-grid {
 grid-template-columns: 1fr;
 }
 }
 `}</style>
 </MainLayout>
 );
}
