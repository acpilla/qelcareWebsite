import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../utils/auth";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  inputStyle,
  todayISO,
} from "../Workflow/ClinicUi";

const APPOINTMENT_TYPES = [
  { value: "consultation", label: "Consultation" },
  { value: "follow_up", label: "Follow-up" },
  { value: "walk_in", label: "Walk-in" },
  { value: "emergency", label: "Emergency" },
];

export default function UserBooking({ onViewAppointments }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    doctor_id: "",
    specialty_id: "",
    date: todayISO(),
    time: "09:00",
    type: "consultation",
    chief_complaint: "",
    notes: "",
  });

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/users/doctors");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load doctors.");
      setDoctors(payload.doctors || payload.data || []);
    } catch (err) {
      setError(err.message);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => String(doctor.user_id) === String(form.doctor_id)),
    [doctors, form.doctor_id]
  );

  const doctorsBySpecialty = useMemo(() => {
    return doctors.reduce((groups, doctor) => {
      const name = doctor.specialty_name || "Unassigned";
      if (!groups[name]) groups[name] = [];
      groups[name].push(doctor);
      return groups;
    }, {});
  }, [doctors]);

  const canSubmit = Boolean(form.doctor_id && form.date && form.time && !loading && !submitting);

  function updateField(name, value) {
    if (name === "doctor_id") {
      const doctor = doctors.find((item) => String(item.user_id) === String(value));
      setForm((current) => ({
        ...current,
        doctor_id: value,
        specialty_id: doctor?.specialty_id || "",
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.doctor_id || !form.date || !form.time) {
      setError("Doctor, date, and time are required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetch("/appointments/book", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: Number(form.doctor_id),
          specialty_id: form.specialty_id ? Number(form.specialty_id) : selectedDoctor?.specialty_id || null,
          date: form.date,
          time: form.time,
          type: form.type,
          chief_complaint: form.chief_complaint,
          notes: form.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to book appointment.");

      setMessage("Appointment booked. It will stay pending until Frontdesk confirms it.");
      setForm((current) => ({ ...current, chief_complaint: "", notes: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px,.9fr)", gap: 16, alignItems: "start" }}>
      <Panel style={{ padding: 18 }}>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#162235" }}>Book Appointment</div>
            <div style={{ fontSize: 13, color: "#6b778c", marginTop: 3 }}>Choose a doctor, schedule, and reason for visit.</div>
          </div>

          <ErrorState message={error} />
          {message && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>
              {message}
            </div>
          )}

          {loading ? (
            <LoadingState label="Loading available doctors..." />
          ) : doctors.length === 0 ? (
            <EmptyState title="No doctors available" detail="Admin must assign verified doctor accounts to active specialties." />
          ) : (
            <>
              <Field label="Doctor">
                <select style={inputStyle} value={form.doctor_id} onChange={(e) => updateField("doctor_id", e.target.value)}>
                  <option value="">Select doctor</option>
                  {Object.entries(doctorsBySpecialty).map(([specialty, group]) => (
                    <optgroup key={specialty} label={specialty}>
                      {group.map((doctor) => (
                        <option key={doctor.user_id} value={doctor.user_id}>
                          {doctor.doctor_name || `${doctor.first_name} ${doctor.last_name}`} ({doctor.specialty_name || "No specialty"})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              {selectedDoctor && (
                <div style={{ padding: 12, borderRadius: 8, background: "#f7fafd", border: "1px solid #e3ebf5", color: "#42526a", fontSize: 13 }}>
                  <strong style={{ color: "#162235" }}>{selectedDoctor.doctor_name || `${selectedDoctor.first_name} ${selectedDoctor.last_name}`}</strong>
                  <div>{selectedDoctor.specialty_name || "Specialty not assigned"}</div>
                </div>
              )}
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px", gap: 10 }}>
            <Field label="Date">
              <input style={inputStyle} type="date" min={todayISO()} value={form.date} onChange={(e) => updateField("date", e.target.value)} />
            </Field>
            <Field label="Time">
              <input style={inputStyle} type="time" value={form.time} onChange={(e) => updateField("time", e.target.value)} />
            </Field>
            <Field label="Type">
              <select style={inputStyle} value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                {APPOINTMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Chief complaint">
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={form.chief_complaint}
              onChange={(e) => updateField("chief_complaint", e.target.value)}
              placeholder="Short description of the concern"
            />
          </Field>

          <Field label="Notes">
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Optional details"
            />
          </Field>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton type="submit" disabled={!canSubmit}>
              {submitting ? "Booking..." : "Book Appointment"}
            </ActionButton>
            <ActionButton tone="secondary" onClick={onViewAppointments || (() => { window.location.href = "/patient/appointments"; })}>
              View Appointments
            </ActionButton>
          </div>

          {!form.doctor_id && !loading && doctors.length > 0 && (
            <div style={{ color: "#6b778c", fontSize: 12, fontWeight: 700 }}>
              Select a doctor to enable booking.
            </div>
          )}
        </form>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>Available Specialties</div>
        <div style={{ fontSize: 12, color: "#6b778c", marginTop: 2, marginBottom: 12 }}>Available doctors are grouped by active clinic specialty.</div>
        {loading ? (
          <LoadingState />
        ) : doctors.length === 0 ? (
          <EmptyState title="No doctors available" detail="Admin must assign verified doctor accounts to specialties." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(doctorsBySpecialty).map(([specialty, group]) => (
              <div key={specialty} style={{ border: "1px solid #e3ebf5", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 900, color: "#162235" }}>{specialty}</div>
                <div style={{ color: "#6b778c", fontSize: 12 }}>{group.length} doctor(s)</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
