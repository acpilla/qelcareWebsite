import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, getUserRole } from "../../utils/auth";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  StatusBadge,
  formatDate,
  formatTime,
  getRows,
  inputStyle,
  todayISO,
} from "../Workflow/ClinicUi";

const APPOINTMENT_MANAGER_ROLES = ["Admin", "Frontdesk"];
const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "IN_QUEUE", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"];
const ACTIVE_STATUSES = ["IN_QUEUE", "CONFIRMED", "PENDING", "RESCHEDULED"];
const STATUS_ORDER = {
  IN_QUEUE: 0,
  CONFIRMED: 1,
  PENDING: 2,
  RESCHEDULED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
  NO_SHOW: 6,
};

function scheduleValue(item) {
  const date = String(item.date || "").slice(0, 10);
  const time = String(item.time || "00:00").slice(0, 5);
  const value = new Date(`${date}T${time}:00`).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareAppointments(a, b) {
  const aActive = ACTIVE_STATUSES.includes(a.status);
  const bActive = ACTIVE_STATUSES.includes(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;

  const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  const aSchedule = scheduleValue(a);
  const bSchedule = scheduleValue(b);
  if (aActive && bActive && aSchedule !== bSchedule) return aSchedule - bSchedule;
  if (!aActive && !bActive && aSchedule !== bSchedule) return bSchedule - aSchedule;

  return Number(b.id || 0) - Number(a.id || 0);
}

function appointmentDate(item) {
  return String(item.date || "").slice(0, 10);
}

function isTodayOrPast(item) {
  const date = appointmentDate(item);
  return Boolean(date && date <= todayISO());
}

function workflowHelp(status, isPatient) {
  const patientCopy = {
    PENDING: "Waiting for clinic confirmation.",
    CONFIRMED: "Confirmed. Please arrive on time for queue processing.",
    IN_QUEUE: "You are in the live clinic queue.",
    COMPLETED: "Consultation completed. Records and prescriptions appear after doctor entry.",
    CANCELLED: "This appointment was cancelled.",
    RESCHEDULED: "Schedule was changed and is awaiting clinic confirmation.",
    NO_SHOW: "Marked as no-show by the clinic.",
  };

  const staffCopy = {
    PENDING: "Confirm, reschedule, or cancel.",
    CONFIRMED: "Approved. Same-day visits enter queue automatically.",
    IN_QUEUE: "Nurse and doctor workflow is active.",
    COMPLETED: "Ready for cashier billing if unpaid.",
    CANCELLED: "Cancelled appointment history.",
    RESCHEDULED: "Confirm the new schedule or cancel.",
    NO_SHOW: "No-show history.",
  };

  return (isPatient ? patientCopy : staffCopy)[status] || "No workflow note.";
}

export default function AppointmentList() {
  const role = getUserRole();
  const isPatient = role === "Patient";
  const canManage = APPOINTMENT_MANAGER_ROLES.includes(role);

  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reschedule, setReschedule] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isPatient ? "/appointments/me?limit=100" : "/appointments?limit=100";
      const response = await authFetch(endpoint);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load appointments.");
      setAppointments(getRows(payload, "appointments"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isPatient]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments
      .filter((item) => status === "ALL" || item.status === status)
      .filter((item) => !date || String(item.date || "").slice(0, 10) === date)
      .filter((item) => {
        if (!q) return true;
        return [
          item.patient_name,
          item.doctor_name,
          item.specialty_name,
          item.chief_complaint,
          String(item.id || ""),
        ].some((value) => String(value || "").toLowerCase().includes(q));
      })
      .sort(compareAppointments);
  }, [appointments, date, search, status]);

  async function changeStatus(appointment, nextStatus) {
    let cancelReason = "";
    if (nextStatus === "CANCELLED") {
      cancelReason = window.prompt("Cancellation reason");
      if (!cancelReason) return;
    }

    setSavingId(appointment.id);
    setError("");
    setMessage("");
    try {
      const response = await authFetch(`/appointments/${appointment.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, cancel_reason: cancelReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update appointment.");
      setMessage(payload.message || `Appointment #${appointment.id} changed to ${nextStatus}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!reschedule?.date || !reschedule?.time) return;
    setSavingId(reschedule.id);
    setError("");
    setMessage("");
    try {
      const response = await authFetch(`/appointments/${reschedule.id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ date: reschedule.date, time: reschedule.time }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to reschedule appointment.");
      setMessage(`Appointment #${reschedule.id} rescheduled and returned to pending.`);
      setReschedule(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel style={{ padding: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "#42526a", fontSize: 13, lineHeight: 1.45 }}>
            {isPatient
              ? "Bookings are clinic-controlled after submission. Frontdesk confirms schedules, same-day confirmed visits enter the queue, nurses record vitals, doctors complete records, and cashier handles billing after consultation."
              : "Appointment control belongs to Admin and Frontdesk. Nurses work from the live queue, doctors work from assigned consultations, and cashier bills completed visits."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 150px 150px auto", gap: 10, alignItems: "end" }}>
          <Field label="Search">
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, doctor, specialty, appointment #" />
          </Field>
          <Field label="Status">
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((item) => (
                <option key={item} value={item}>{item === "ALL" ? "All statuses" : item.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
          </div>
        </div>
      </Panel>

      <ErrorState message={error} />
      {message && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{message}</div>}

      {reschedule && (
        <Panel style={{ padding: 16 }}>
          <form onSubmit={submitReschedule} style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px auto auto", gap: 10, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b778c", fontWeight: 800 }}>Rescheduling</div>
              <div style={{ fontWeight: 900, color: "#162235" }}>#{reschedule.id} {reschedule.patient_name}</div>
            </div>
            <Field label="New date">
              <input style={inputStyle} type="date" min={todayISO()} value={reschedule.date} onChange={(e) => setReschedule({ ...reschedule, date: e.target.value })} />
            </Field>
            <Field label="New time">
              <input style={inputStyle} type="time" value={reschedule.time} onChange={(e) => setReschedule({ ...reschedule, time: e.target.value })} />
            </Field>
            <ActionButton disabled={savingId === reschedule.id}>Save</ActionButton>
            <ActionButton tone="secondary" onClick={() => setReschedule(null)}>Cancel</ActionButton>
          </form>
        </Panel>
      )}

      <Panel style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>{isPatient ? "My Appointments" : "Appointments"}</div>
            <div style={{ fontSize: 12, color: "#6b778c", marginTop: 2 }}>
              {filtered.length} record(s) - active appointments first, then completed/cancelled history
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading appointments..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No appointments found" detail="Adjust filters or refresh the list." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7fafd", color: "#65758b" }}>
                  {["ID", "Patient", "Doctor", "Specialty", "Schedule", "Status", isPatient ? "Next Step" : "Workflow"].map((heading) => (
                    <th key={heading} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eef3f9" }}>
                    <td style={{ padding: "12px 14px", color: "#6b778c", fontWeight: 800 }}>#{item.id}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 900, color: "#162235" }}>{item.patient_name || "-"}</div>
                      <div style={{ fontSize: 12, color: "#6b778c" }}>{item.patient_phone || item.patient_email || ""}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{item.doctor_name || "-"}</td>
                    <td style={{ padding: "12px 14px" }}>{item.specialty_name || "-"}</td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{formatDate(item.date)} at {formatTime(item.time)}</td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      {canManage ? (
                        <div style={{ display: "grid", gap: 7 }}>
                          <div style={{ color: "#6b778c", fontSize: 12 }}>{workflowHelp(item.status, false)}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.status === "PENDING" && <ActionButton disabled={savingId === item.id} tone="success" onClick={() => changeStatus(item, "CONFIRMED")}>Confirm</ActionButton>}
                            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) && <ActionButton disabled={savingId === item.id} tone="secondary" onClick={() => setReschedule({ id: item.id, patient_name: item.patient_name, date: item.date || todayISO(), time: item.time || "" })}>Reschedule</ActionButton>}
                            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) && <ActionButton disabled={savingId === item.id} tone="danger" onClick={() => changeStatus(item, "CANCELLED")}>Cancel</ActionButton>}
                            {["CONFIRMED", "IN_QUEUE"].includes(item.status) && isTodayOrPast(item) && <ActionButton disabled={savingId === item.id} tone="warning" onClick={() => changeStatus(item, "NO_SHOW")}>No Show</ActionButton>}
                            {!["PENDING", "CONFIRMED", "RESCHEDULED", "IN_QUEUE"].includes(item.status) && <span style={{ color: "#6b778c" }}>No action</span>}
                          </div>
                        </div>
                      ) : isPatient ? (
                        <span style={{ color: "#42526a", fontSize: 12, lineHeight: 1.45 }}>{workflowHelp(item.status, true)}</span>
                      ) : (
                        <span style={{ color: "#42526a", fontSize: 12, lineHeight: 1.45 }}>{workflowHelp(item.status, false)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
