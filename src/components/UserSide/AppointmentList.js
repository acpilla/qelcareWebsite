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

const STAFF_ROLES = ["Admin", "Frontdesk", "Nurse", "Doctor"];
const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "IN_QUEUE", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"];
const PATIENT_VIEWS = [
  { value: "ACTIVE", label: "Active" },
  { value: "HISTORY", label: "History" },
  { value: "ALL", label: "All" },
];
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "RESCHEDULED"];
const HISTORY_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export default function AppointmentList() {
  const role = getUserRole();
  const isPatient = role === "Patient";
  const canManage = STAFF_ROLES.includes(role);

  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [patientView, setPatientView] = useState("ACTIVE");
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

  const patientCounts = useMemo(() => {
    return {
      active: appointments.filter((item) => ACTIVE_STATUSES.includes(item.status)).length,
      history: appointments.filter((item) => HISTORY_STATUSES.includes(item.status)).length,
      all: appointments.length,
    };
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return appointments
      .filter((item) => {
        if (!isPatient) return status === "ALL" || item.status === status;
        if (patientView === "ACTIVE") return ACTIVE_STATUSES.includes(item.status);
        if (patientView === "HISTORY") return HISTORY_STATUSES.includes(item.status);
        return true;
      })
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
      .sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`));
  }, [appointments, date, isPatient, patientView, search, status]);

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
      setMessage(`Appointment #${appointment.id} changed to ${nextStatus}.`);
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
        <div style={{ display: "grid", gridTemplateColumns: isPatient ? "2fr 170px 150px auto" : "2fr 150px 150px auto", gap: 10, alignItems: "end" }}>
          <Field label="Search">
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isPatient ? "Doctor, specialty, appointment #" : "Patient, doctor, specialty, appointment #"} />
          </Field>

          {isPatient ? (
            <Field label="View">
              <select style={inputStyle} value={patientView} onChange={(e) => setPatientView(e.target.value)}>
                {PATIENT_VIEWS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Status">
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_FILTERS.map((item) => (
                  <option key={item} value={item}>{item === "ALL" ? "All statuses" : item.replace("_", " ")}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Date">
            <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
        </div>
      </Panel>

      {isPatient && (
        <Panel style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PATIENT_VIEWS.map((item) => {
              const active = patientView === item.value;
              const count = item.value === "ACTIVE" ? patientCounts.active : item.value === "HISTORY" ? patientCounts.history : patientCounts.all;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPatientView(item.value)}
                  style={{
                    minHeight: 36,
                    padding: "0 13px",
                    borderRadius: 8,
                    border: `1px solid ${active ? "#163a6b" : "#cddbeb"}`,
                    background: active ? "#163a6b" : "#fff",
                    color: active ? "#fff" : "#163a6b",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 900,
                    fontFamily: "inherit",
                  }}
                >
                  {item.label} ({count})
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      <ErrorState message={error} />
      {message && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{message}</div>}

      {reschedule && !isPatient && (
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
            <ActionButton type="submit" disabled={savingId === reschedule.id}>Save</ActionButton>
            <ActionButton tone="secondary" onClick={() => setReschedule(null)}>Cancel</ActionButton>
          </form>
        </Panel>
      )}

      <Panel style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>{isPatient ? "My Appointments" : "Appointments"}</div>
            <div style={{ fontSize: 12, color: "#6b778c", marginTop: 2 }}>
              {filtered.length} record(s){isPatient && patientView === "ACTIVE" ? " - pending, confirmed, queued, or rescheduled" : ""}
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading appointments..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No appointments found"
            detail={isPatient && patientView === "ACTIVE" ? "Booked appointments appear here while the clinic processes them." : "Adjust filters or refresh the list."}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7fafd", color: "#65758b" }}>
                  {(isPatient ? ["ID", "Doctor", "Specialty", "Schedule", "Status", "Concern"] : ["ID", "Patient", "Doctor", "Specialty", "Schedule", "Status", "Actions"]).map((heading) => (
                    <th key={heading} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eef3f9" }}>
                    <td style={{ padding: "12px 14px", color: "#6b778c", fontWeight: 800 }}>#{item.id}</td>

                    {!isPatient && (
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 900, color: "#162235" }}>{item.patient_name || "-"}</div>
                        <div style={{ fontSize: 12, color: "#6b778c" }}>{item.patient_phone || item.patient_email || ""}</div>
                      </td>
                    )}

                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{item.doctor_name || "-"}</td>
                    <td style={{ padding: "12px 14px" }}>{item.specialty_name || "-"}</td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{formatDate(item.date)} at {formatTime(item.time)}</td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>

                    {isPatient ? (
                      <td style={{ padding: "12px 14px", color: "#42526a", maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.chief_complaint || item.notes || "Clinic controlled"}
                        </div>
                      </td>
                    ) : (
                      <td style={{ padding: "12px 14px" }}>
                        {canManage ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.status === "PENDING" && <ActionButton disabled={savingId === item.id} tone="success" onClick={() => changeStatus(item, "CONFIRMED")}>Confirm</ActionButton>}
                            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) && <ActionButton disabled={savingId === item.id} tone="secondary" onClick={() => setReschedule({ id: item.id, patient_name: item.patient_name, date: item.date || todayISO(), time: item.time || "" })}>Reschedule</ActionButton>}
                            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) && <ActionButton disabled={savingId === item.id} tone="danger" onClick={() => changeStatus(item, "CANCELLED")}>Cancel</ActionButton>}
                            {["CONFIRMED", "IN_QUEUE"].includes(item.status) && <ActionButton disabled={savingId === item.id} tone="warning" onClick={() => changeStatus(item, "NO_SHOW")}>No Show</ActionButton>}
                            {!["PENDING", "CONFIRMED", "RESCHEDULED", "IN_QUEUE"].includes(item.status) && <span style={{ color: "#6b778c" }}>No action</span>}
                          </div>
                        ) : (
                          <span style={{ color: "#6b778c" }}>Clinic controlled</span>
                        )}
                      </td>
                    )}
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
