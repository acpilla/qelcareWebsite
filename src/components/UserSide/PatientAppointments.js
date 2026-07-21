import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authFetch } from "../../utils/auth";
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
import UserBooking from "./UserBooking";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "history", label: "History" },
  { id: "book", label: "Book Appointment" },
  { id: "relatives", label: "Relatives" },
];

const GENDERS = ["", "Male", "Female", "Other"];
const emptyRelative = () => ({ first_name: "", last_name: "", relationship: "", date_of_birth: "", age: "", gender: "", phone: "", email: "" });

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "FOR_BILLING", "RESCHEDULED"];
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"];
// Patients can edit OR cancel their own appointment only while it is still a
// request (pending/rescheduled). Once the clinic confirms it, self-service is
// locked and they must call the clinic so staff can adjust the schedule/queue.
const CANCELLABLE = ["PENDING", "RESCHEDULED"];
const EDITABLE = ["PENDING", "RESCHEDULED"];
const CLINIC_OPEN = "08:00";
const CLINIC_CLOSE = "20:00";
const CLINIC_PHONE = "(02) 8842-5405";

function manilaNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function scheduleKey(item) {
  const date = String(item.date || "").slice(0, 10);
  const time = String(item.time || "00:00").slice(0, 5);
  return `${date}T${time}`;
}

function isHistory(item) {
  if (item.is_history === true) return true;
  if (TERMINAL_STATUSES.includes(item.status)) return true;
  if (item.status === "FOR_BILLING") return false; // visit done but awaiting payment = still active
  return ACTIVE_STATUSES.includes(item.status) && scheduleKey(item) <= manilaNowParts();
}

function bookingTarget(item) {
  if (item.booked_for === "other") {
    return item.booked_for_relationship ? `Someone else - ${item.booked_for_relationship}` : "Someone else";
  }
  return "Myself";
}

function compareUpcoming(a, b) {
  return scheduleKey(a).localeCompare(scheduleKey(b)) || Number(b.id || 0) - Number(a.id || 0);
}

function compareHistory(a, b) {
  return scheduleKey(b).localeCompare(scheduleKey(a)) || Number(b.id || 0) - Number(a.id || 0);
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 8,
        border: `1px solid ${active ? "#163a6b" : "#d7e2ef"}`,
        background: active ? "#163a6b" : "#fff",
        color: active ? "#fff" : "#163a6b",
        cursor: "pointer",
        fontWeight: 900,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export default function PatientAppointments() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const activeTab = TABS.some((tab) => tab.id === tabParam) ? tabParam : "upcoming";

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ date: "", time: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/appointments/me?limit=100");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load appointments.");
      setAppointments(getRows(payload, "appointments"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelAppt(item) {
    const reason = window.prompt(`Cancel appointment #${item.id} on ${formatDate(item.date)} at ${formatTime(item.time)}?\n\nPlease enter a reason for cancelling:`, "");
    if (reason === null) return; // patient dismissed the prompt
    if (!reason.trim()) { setActionErr("A reason is required to cancel."); return; }
    setBusyId(item.id);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await authFetch(`/appointments/${item.id}/cancel`, { method: "POST", body: JSON.stringify({ cancel_reason: reason.trim() }) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to cancel appointment.");
      setActionMsg(`Appointment #${item.id} cancelled.`);
      await load();
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(item) {
    setEditing(item);
    setEditForm({ date: String(item.date).slice(0, 10), time: String(item.time).slice(0, 5) });
    setActionErr("");
    setActionMsg("");
  }

  async function submitEdit() {
    if (!editForm.date || !editForm.time) { setActionErr("New date and time are required."); return; }
    setBusyId(editing.id);
    setActionErr("");
    try {
      const res = await authFetch(`/appointments/${editing.id}/edit`, { method: "PUT", body: JSON.stringify(editForm) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to update appointment.");
      setActionMsg("Appointment updated. It will stay pending until the clinic confirms it.");
      setEditing(null);
      await load();
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const actions = { onCancel: cancelAppt, onEdit: openEdit, busyId };

  const upcoming = useMemo(
    () => appointments.filter((item) => ACTIVE_STATUSES.includes(item.status) && !isHistory(item)).sort(compareUpcoming),
    [appointments]
  );
  const history = useMemo(
    () => appointments.filter(isHistory).sort(compareHistory),
    [appointments]
  );

  function changeTab(tab) {
    setParams(tab === "upcoming" ? {} : { tab });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TABS.map((tab) => (
              <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => changeTab(tab.id)}>
                {tab.label}
              </TabButton>
            ))}
          </div>
          <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
        </div>
      </Panel>

      <ErrorState message={error} />
      {actionErr && <ErrorState message={actionErr} />}
      {actionMsg && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{actionMsg}</div>}

      {activeTab === "book" ? (
        <UserBooking onViewAppointments={() => changeTab("upcoming")} onBooked={() => { load(); changeTab("upcoming"); }} />
      ) : activeTab === "relatives" ? (
        <RelativesTab />
      ) : loading ? (
        <LoadingState label="Loading appointments..." />
      ) : activeTab === "upcoming" ? (
        <>
          {upcoming.length > 0 && <VisitProgress appointment={upcoming[0]} />}
          <AppointmentTable
            title="Upcoming Appointments"
            rows={upcoming}
            emptyTitle="No upcoming appointments"
            emptyDetail="Book an appointment to start the clinic flow."
            actions={actions}
          />
        </>
      ) : (
        <AppointmentTable
          title="Appointment History"
          rows={history}
          emptyTitle="No appointment history"
          emptyDetail="Past, completed, cancelled, and no-show appointments appear here."
          history
        />
      )}

      {editing && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(8,18,33,.46)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}
          onClick={() => setEditing(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 94vw)" }}>
          <Panel style={{ padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#162235", marginBottom: 4 }}>Edit Appointment #{editing.id}</div>
            <div style={{ fontSize: 12, color: "#6b778c", marginBottom: 14 }}>Changing the schedule sets it back to pending for clinic confirmation.</div>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Date">
                <input style={inputStyle} type="date" min={todayISO()} value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="Time">
                <input style={inputStyle} type="time" min={CLINIC_OPEN} max={CLINIC_CLOSE} value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} />
                <div style={{ fontSize: 11, color: "#8a97a8", marginTop: 4 }}>Clinic hours: 8:00 AM – 8:00 PM</div>
              </Field>
              {actionErr && <ErrorState message={actionErr} />}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <ActionButton tone="secondary" onClick={() => setEditing(null)}>Close</ActionButton>
                <ActionButton onClick={submitEdit} disabled={busyId === editing.id}>{busyId === editing.id ? "Saving..." : "Save Changes"}</ActionButton>
              </div>
            </div>
          </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

const VISIT_STAGES = [
  { key: "requested", label: "Requested" },
  { key: "confirmed", label: "Confirmed" },
  { key: "queue", label: "In Queue" },
  { key: "payment", label: "Payment" },
  { key: "completed", label: "Completed" },
];

function visitStageIndex(status) {
  switch (status) {
    case "PENDING": return 0;
    case "CONFIRMED": return 1;
    case "IN_QUEUE": return 2;
    case "FOR_BILLING": return 3;
    case "COMPLETED": return 4;
    default: return -1; // cancelled / no-show: no progress to show
  }
}

// A simple stepper showing where the patient's soonest visit is in the clinic
// process: Requested -> Confirmed -> In Queue (check-in/vitals) -> Completed.
function VisitProgress({ appointment }) {
  if (!appointment) return null;
  const idx = visitStageIndex(appointment.status);
  if (idx < 0) return null;
  return (
    <Panel style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#162235", marginBottom: 2 }}>Your visit progress</div>
      <div style={{ fontSize: 12, color: "#6b778c", marginBottom: 14 }}>
        {appointment.doctor_name || "Doctor"}{appointment.specialty_name ? ` - ${appointment.specialty_name}` : ""} - {formatDate(appointment.date)} at {formatTime(appointment.time)}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {VISIT_STAGES.map((stage, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <React.Fragment key={stage.key}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto", width: 66 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: done ? "#0e8a7a" : current ? "#163a6b" : "#eef2f6",
                  color: done || current ? "#fff" : "#94a2b6",
                  display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13,
                  boxShadow: current ? "0 0 0 4px rgba(22,58,107,.15)" : "none",
                }}>{i + 1}</div>
                <div style={{ fontSize: 11, fontWeight: 800, textAlign: "center", color: done ? "#0e8a7a" : current ? "#163a6b" : "#94a2b6" }}>{stage.label}</div>
              </div>
              {i < VISIT_STAGES.length - 1 && (
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: i < idx ? "#0e8a7a" : "#e3ebf5", marginTop: 14 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Panel>
  );
}

function RelativesTab() {
  const [relatives, setRelatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyRelative());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/relatives");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to load relatives.");
      setRelatives(payload.relatives || payload.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (name, value) => {
    let v = value;
    if (name === "first_name" || name === "last_name") {
      v = value.replace(/[^A-Za-zÀ-ÿ.'\- ]/g, "").toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, (_m, s, c) => s + c.toUpperCase());
    }
    setForm((c) => ({ ...c, [name]: v }));
  };

  const reset = () => { setForm(emptyRelative()); setEditingId(null); };

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.relationship.trim()) {
      setError("First name, last name, and relationship are required.");
      return;
    }
    setSaving(true); setError(""); setMsg("");
    try {
      const endpoint = editingId ? `/relatives/${editingId}` : "/relatives";
      const method = editingId ? "PATCH" : "POST";
      const res = await authFetch(endpoint, { method, body: JSON.stringify(form) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to save relative.");
      setMsg(editingId ? "Relative updated." : "Relative saved.");
      reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (r) => {
    setEditingId(r.relative_id);
    setForm({
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      relationship: r.relationship || "",
      date_of_birth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : "",
      age: r.age ?? "",
      gender: r.gender || "",
      phone: r.phone || "",
      email: r.email || "",
    });
    setMsg("");
  };

  const remove = async (r) => {
    if (!window.confirm(`Remove ${r.first_name} ${r.last_name} from your saved relatives?`)) return;
    setError("");
    try {
      const res = await authFetch(`/relatives/${r.relative_id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to remove relative.");
      if (editingId === r.relative_id) reset();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel style={{ padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#162235" }}>{editingId ? "Edit relative" : "Add a relative"}</div>
        <div style={{ fontSize: 13, color: "#6b778c", marginTop: 3, marginBottom: 12 }}>Save the people you book for so you don't have to retype them. They appear in the "Someone else" picker when booking.</div>
        <ErrorState message={error} />
        {msg && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{msg}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First name"><input style={inputStyle} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} /></Field>
            <Field label="Last name"><input style={inputStyle} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 110px", gap: 10 }}>
            <Field label="Relationship"><input style={inputStyle} value={form.relationship} onChange={(e) => setField("relationship", e.target.value)} placeholder="Parent, child, spouse" /></Field>
            <Field label="Birth date"><input style={inputStyle} type="date" value={form.date_of_birth} onChange={(e) => setField("date_of_birth", e.target.value)} /></Field>
            <Field label="Age"><input style={inputStyle} type="number" min="0" max="130" value={form.age} onChange={(e) => setField("age", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", gap: 10 }}>
            <Field label="Gender">
              <select style={inputStyle} value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
                {GENDERS.map((g) => <option key={g || "blank"} value={g}>{g || "Select"}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Update relative" : "Save relative"}</ActionButton>
            {editingId && <ActionButton tone="secondary" onClick={reset}>Cancel edit</ActionButton>}
          </div>
        </div>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#162235", marginBottom: 12 }}>Saved relatives ({relatives.length})</div>
        {loading ? (
          <LoadingState label="Loading relatives..." />
        ) : relatives.length === 0 ? (
          <EmptyState title="No saved relatives" detail="Add someone above, or tick 'Save this person' while booking for someone else." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {relatives.map((r) => (
              <div key={r.relative_id} style={{ border: "1px solid #e3ebf5", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>{r.first_name} {r.last_name}</div>
                  <div style={{ color: "#6b778c", fontSize: 12, marginTop: 2 }}>
                    {r.relationship}{r.age ? ` - ${r.age} y/o` : ""}{r.gender ? ` - ${r.gender}` : ""}
                  </div>
                  {(r.phone || r.email) && <div style={{ color: "#42526a", fontSize: 12, marginTop: 2 }}>{[r.phone, r.email].filter(Boolean).join(" - ")}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <ActionButton tone="secondary" onClick={() => edit(r)}>Edit</ActionButton>
                  <ActionButton tone="danger" onClick={() => remove(r)}>Delete</ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AppointmentTable({ title, rows, emptyTitle, emptyDetail, history = false, actions = null }) {
  return (
    <Panel style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#6b778c", marginTop: 2 }}>
            {rows.length} record(s){history ? " - read-only history" : " - clinic confirmation required before queueing"}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} detail={emptyDetail} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f7fafd", color: "#65758b" }}>
                {["ID", "Patient", "Booked For", "Doctor", "Specialty", "Schedule", "Status", "Details", ...(actions ? ["Actions"] : [])].map((heading) => (
                  <th key={heading} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #eef3f9" }}>
                  <td style={{ padding: "12px 14px", color: "#6b778c", fontWeight: 800 }}>#{item.id}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 900, color: "#162235" }}>{item.patient_name || "-"}</div>
                    <div style={{ fontSize: 12, color: "#6b778c" }}>{item.patient_phone || item.patient_email || ""}</div>
                  </td>
                  <td style={{ padding: "12px 14px", color: "#42526a", fontWeight: 800 }}>{bookingTarget(item)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{item.doctor_name || "-"}</td>
                  <td style={{ padding: "12px 14px" }}>{item.specialty_name || "-"}</td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{formatDate(item.date)} at {formatTime(item.time)}</td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
                  <td style={{ padding: "12px 14px", color: "#42526a", minWidth: 180 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.45 }}>{item.chief_complaint || item.notes || "-"}</div>
                  </td>
                  {actions && (
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {EDITABLE.includes(item.status) && (
                          <ActionButton tone="secondary" disabled={actions.busyId === item.id} onClick={() => actions.onEdit(item)}>Edit</ActionButton>
                        )}
                        {CANCELLABLE.includes(item.status) && (
                          <ActionButton tone="danger" disabled={actions.busyId === item.id} onClick={() => actions.onCancel(item)}>Cancel</ActionButton>
                        )}
                        {!EDITABLE.includes(item.status) && !CANCELLABLE.includes(item.status) && (
                          <span style={{ color: "#6b778c", fontSize: 11, fontWeight: 700, whiteSpace: "normal", maxWidth: 210, display: "inline-block", lineHeight: 1.4 }}>
                            Confirmed — call the clinic at {CLINIC_PHONE} to change or cancel.
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
