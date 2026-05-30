import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../utils/auth";
import MainLayout from "../Layout/MainLayout";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  formatDate,
  inputStyle,
} from "../Workflow/ClinicUi";

const blankForm = {
  first_name: "",
  last_name: "",
  middle_name: "",
  suffix: "",
  email: "",
  phone: "",
  alternate_phone: "",
  gender: "",
  date_of_birth: "",
  address_line: "",
};

function nameFrom(profile, patient) {
  return [
    profile?.first_name || patient?.first_name,
    profile?.middle_name || patient?.middle_name,
    profile?.last_name || patient?.last_name,
    profile?.suffix || patient?.suffix,
  ].filter(Boolean).join(" ").trim() || patient?.display_name || patient?.name || "Patient";
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return "";
  const birth = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? `${age} years old` : "";
}

function makeForm(profile, patient) {
  return {
    first_name: profile?.first_name || patient?.first_name || "",
    last_name: profile?.last_name || patient?.last_name || "",
    middle_name: profile?.middle_name || patient?.middle_name || "",
    suffix: profile?.suffix || patient?.suffix || "",
    email: profile?.email || patient?.email || patient?.user_email || "",
    phone: profile?.phone || patient?.phone || patient?.contact || "",
    alternate_phone: profile?.alternate_phone || "",
    gender: profile?.gender || patient?.gender || "",
    date_of_birth: profile?.date_of_birth || patient?.date_of_birth || "",
    address_line: profile?.address_line || patient?.address || "",
  };
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [profileRes, patientRes] = await Promise.all([
        authFetch("/users/me"),
        authFetch("/patients/me"),
      ]);

      const profilePayload = await profileRes.json();
      const patientPayload = await patientRes.json();

      if (!profileRes.ok) throw new Error(profilePayload.message || "Failed to load account profile.");
      if (!patientRes.ok) throw new Error(patientPayload.message || "Failed to load patient profile.");

      const profileData = profilePayload.data || profilePayload.user || profilePayload.profile;
      const patientData = patientPayload.patient || patientPayload.data;

      setProfile(profileData);
      setPatient(patientData);
      setForm(makeForm(profileData, patientData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = useMemo(() => nameFrom(profile, patient), [profile, patient]);
  const ageLabel = useMemo(() => ageFrom(form.date_of_birth || patient?.date_of_birth), [form.date_of_birth, patient]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          middle_name: form.middle_name.trim(),
          suffix: form.suffix.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          alternate_phone: form.alternate_phone.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth || null,
          address_line: form.address_line.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update profile.");

      const updatedProfile = payload.data || payload.profile || payload.user;
      setProfile(updatedProfile);
      setForm((current) => makeForm(updatedProfile, { ...patient, ...current }));

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          localStorage.setItem("user", JSON.stringify({ ...user, ...updatedProfile }));
        } catch {
          // Ignore invalid localStorage data.
        }
      }

      setMessage("Profile updated. Your name and contact details now sync with appointments, queue, and patient records.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout pageTitle="Profile Settings" pageSubtitle="Keep your patient identity and contact details synced across the clinic flow">
      <div style={{ display: "grid", gap: 14 }}>
        <ErrorState message={error} />
        {message && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>
            {message}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading profile..." />
        ) : !profile || !patient ? (
          <EmptyState title="Profile not available" detail="Please refresh or contact the clinic if this continues." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
            <Panel style={{ padding: 18 }}>
              <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 12 }}>
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={displayName}
                    style={{ width: 104, height: 104, borderRadius: "50%", objectFit: "cover", border: "4px solid #e8eef6" }}
                  />
                ) : (
                  <div style={{ width: 104, height: 104, borderRadius: "50%", display: "grid", placeItems: "center", background: "#eaf1ff", color: "#163a6b", fontSize: 30, fontWeight: 900, border: "4px solid #dbe8ff" }}>
                    {initials(displayName)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#162235" }}>{displayName}</div>
                  <div style={{ color: "#6b778c", fontSize: 13 }}>Patient #{patient.id}</div>
                </div>
                <div style={{ width: "100%", display: "grid", gap: 8, marginTop: 6 }}>
                  <SummaryRow label="Account" value={profile.username || "-"} />
                  <SummaryRow label="Status" value={profile.status || "-"} />
                  <SummaryRow label="Age" value={ageLabel || "-"} />
                  <SummaryRow label="Gender" value={form.gender || "-"} />
                  <SummaryRow label="Birthday" value={form.date_of_birth ? formatDate(form.date_of_birth) : "-"} />
                </div>
              </div>
            </Panel>

            <Panel style={{ padding: 18 }}>
              <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#162235" }}>Personal Information</div>
                  <div style={{ fontSize: 13, color: "#6b778c", marginTop: 3 }}>
                    These fields update both your account profile and linked patient profile.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="First name">
                    <input style={inputStyle} value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} />
                  </Field>
                  <Field label="Last name">
                    <input style={inputStyle} value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} />
                  </Field>
                  <Field label="Middle name">
                    <input style={inputStyle} value={form.middle_name} onChange={(event) => updateField("middle_name", event.target.value)} />
                  </Field>
                  <Field label="Suffix">
                    <input style={inputStyle} value={form.suffix} onChange={(event) => updateField("suffix", event.target.value)} placeholder="Jr., III, etc." />
                  </Field>
                  <Field label="Gender">
                    <select style={inputStyle} value={form.gender || ""} onChange={(event) => updateField("gender", event.target.value)}>
                      <option value="">Not specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Date of birth">
                    <input style={inputStyle} type="date" value={form.date_of_birth || ""} onChange={(event) => updateField("date_of_birth", event.target.value)} />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Email address">
                    <input style={inputStyle} type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                  </Field>
                  <Field label="Phone number">
                    <input style={inputStyle} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                  </Field>
                  <Field label="Alternate phone">
                    <input style={inputStyle} value={form.alternate_phone} onChange={(event) => updateField("alternate_phone", event.target.value)} />
                  </Field>
                  <Field label="Address">
                    <input style={inputStyle} value={form.address_line} onChange={(event) => updateField("address_line", event.target.value)} />
                  </Field>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</ActionButton>
                  <ActionButton tone="secondary" onClick={load}>Reset</ActionButton>
                </div>
              </form>
            </Panel>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, border: "1px solid #e8eef6", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
      <span style={{ color: "#6b778c", fontWeight: 800 }}>{label}</span>
      <span style={{ color: "#162235", fontWeight: 900, textAlign: "right" }}>{value}</span>
    </div>
  );
}
