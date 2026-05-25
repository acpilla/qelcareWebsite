import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../utils/auth";
import MainLayout from "../Layout/MainLayout";
import MedicalRecords from "../UserSide/MedicalRecords";
import {
 ActionButton,
 EmptyState,
 ErrorState,
 LoadingState,
 Panel,
 StatusBadge,
 formatDate,
 formatTime,
 getRows,
 todayISO,
} from "../Workflow/ClinicUi";

export default function DoctorDashboard() {
 const [appointments, setAppointments] = useState([]);
 const [queueEntries, setQueueEntries] = useState([]);
 const [selected, setSelected] = useState(null);
 const [vitals, setVitals] = useState([]);
 const [history, setHistory] = useState([]);
 const [loading, setLoading] = useState(true);
 const [detailLoading, setDetailLoading] = useState(false);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");

 const load = useCallback(async () => {
 setLoading(true);
 setError("");
 try {
 const [appointmentRes, specialtyRes] = await Promise.all([
 authFetch(`/appointments?date=${todayISO()}&limit=100`),
 authFetch(`/queue/specialties?date=${todayISO()}`),
 ]);
 const appointmentPayload = await appointmentRes.json();
 const specialtyPayload = await specialtyRes.json();
 if (!appointmentRes.ok) throw new Error(appointmentPayload.message || "Failed to load appointments.");
 if (!specialtyRes.ok) throw new Error(specialtyPayload.message || "Failed to load queue specialties.");

 const specs = getRows(specialtyPayload, "specialties");
 const queuePayloads = await Promise.all(
 specs.map(async (spec) => {
 const response = await authFetch(`/queue/specialty/${spec.specialty_id}?date=${todayISO()}`);
 const payload = await response.json();
 return response.ok ? getRows(payload, "queue") : [];
 })
 );

 const rows = getRows(appointmentPayload, "appointments").filter((item) => !["CANCELLED", "NO_SHOW"].includes(item.status));
 setAppointments(rows);
 setQueueEntries(queuePayloads.flat());
 setSelected((current) => current || rows.find((item) => item.status === "IN_QUEUE") || rows[0] || null);
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 useEffect(() => {
 if (!selected) {
 setVitals([]);
 setHistory([]);
 return;
 }

 async function loadDetails() {
 setDetailLoading(true);
 setError("");
 try {
 const [vitalRes, historyRes] = await Promise.all([
 authFetch(`/vitals/appointment/${selected.id}`),
 authFetch(`/medical-records/patient/${selected.patient_id}`),
 ]);
 const vitalPayload = await vitalRes.json();
 const historyPayload = await historyRes.json();
 if (!vitalRes.ok) throw new Error(vitalPayload.message || "Failed to load vitals.");
 if (!historyRes.ok) throw new Error(historyPayload.message || "Failed to load patient history.");
 setVitals(getRows(vitalPayload, "vitals"));
 setHistory(getRows(historyPayload, "records"));
 } catch (err) {
 setError(err.message);
 } finally {
 setDetailLoading(false);
 }
 }

 loadDetails();
 }, [selected]);

 const queueByAppointment = useMemo(() => {
 return queueEntries.reduce((map, entry) => {
 map[entry.appointment_id] = entry;
 return map;
 }, {});
 }, [queueEntries]);

 const latestVital = vitals[0] || null;

 async function completeVisit() {
 if (!selected) return;
 setError("");
 setMessage("");
 try {
 const queueEntry = queueByAppointment[selected.id];
 if (queueEntry && queueEntry.status !== "DONE") {
 const response = await authFetch(`/queue/${queueEntry.queue_id}/status`, {
 method: "PATCH",
 body: JSON.stringify({ status: "DONE", notes: "Consultation completed by doctor." }),
 });
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to complete queue.");
 } else if (selected.status === "IN_QUEUE") {
 const response = await authFetch(`/appointments/${selected.id}/status`, {
 method: "PATCH",
 body: JSON.stringify({ status: "COMPLETED" }),
 });
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to complete appointment.");
 }
 setMessage("Visit completed.");
 await load();
 } catch (err) {
 setError(err.message);
 }
 }

 return (
 <MainLayout pageTitle="Doctor Dashboard" pageSubtitle="Assigned queue, vitals, history, and record creation">
 <div style={{ display: "grid", gap: 14 }}>
 <ErrorState message={error} />
 {message && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{message}</div>}

 <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,.85fr) minmax(0, 1.15fr)", gap: 14, alignItems: "start" }}>
 <Panel style={{ overflow: "hidden" }}>
 <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
 <div>
 <div style={{ fontWeight: 900, color: "#162235" }}>Today's Patients</div>
 <div style={{ color: "#6b778c", fontSize: 12 }}>{formatDate(todayISO())}</div>
 </div>
 <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
 </div>

 {loading ? (
 <LoadingState label="Loading assigned appointments..." />
 ) : appointments.length === 0 ? (
 <EmptyState title="No assigned patients today" detail="Paid queued patients will appear after cashier payment." />
 ) : (
 <div style={{ display: "grid" }}>
 {appointments.map((appointment) => {
 const queueEntry = queueByAppointment[appointment.id];
 return (
 <button
 key={appointment.id}
 type="button"
 onClick={() => setSelected(appointment)}
 style={{
 border: "none",
 borderTop: "1px solid #eef3f9",
 background: selected?.id === appointment.id ? "#f2f7ff" : "#fff",
 padding: 14,
 cursor: "pointer",
 textAlign: "left",
 display: "grid",
 gap: 7,
 fontFamily: "inherit",
 }}
 >
 <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
 <strong style={{ color: "#162235" }}>{appointment.patient_name}</strong>
 <StatusBadge status={queueEntry?.status || appointment.status} />
 </div>
 <div style={{ color: "#6b778c", fontSize: 12 }}>
 #{appointment.id} - {formatTime(appointment.time)} - {appointment.specialty_name || "No specialty"}
 </div>
 </button>
 );
 })}
 </div>
 )}
 </Panel>

 <Panel style={{ padding: 16 }}>
 {!selected ? (
 <EmptyState title="Select a patient" detail="Vitals and history will load here." />
 ) : (
 <div style={{ display: "grid", gap: 14 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <div>
 <div style={{ fontSize: 20, fontWeight: 900, color: "#162235" }}>{selected.patient_name}</div>
 <div style={{ color: "#6b778c", fontSize: 13 }}>
 Appointment #{selected.id} - {formatDate(selected.date)} {formatTime(selected.time)}
 </div>
 </div>
 <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
 <StatusBadge status={queueByAppointment[selected.id]?.status || selected.status} />
 {selected.status === "IN_QUEUE" && <ActionButton tone="success" onClick={completeVisit}>Complete Visit</ActionButton>}
 </div>
 </div>

 {detailLoading ? (
 <LoadingState label="Loading clinical details..." />
 ) : (
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
 <ClinicalBlock title="Latest Vitals" rows={[
 ["Blood pressure", latestVital?.blood_pressure],
 ["Heart rate", latestVital?.heart_rate || latestVital?.pulse_rate],
 ["Temperature", latestVital?.temperature],
 ["Oxygen sat", latestVital?.oxygen_sat || latestVital?.oxygen_saturation],
 ["Nurse notes", latestVital?.nurse_notes],
 ]} />
 <ClinicalBlock title="Patient History" rows={[
 ["Previous records", history.length],
 ["Last diagnosis", history[0]?.diagnosis],
 ["Last visit", history[0]?.visit_date ? formatDate(history[0].visit_date) : ""],
 ["Last prescription", history[0]?.prescriptions || history[0]?.prescription],
 ]} />
 </div>
 )}
 </div>
 )}
 </Panel>
 </div>

 {selected && (
 <MedicalRecords
 appointment={selected}
 latestVital={latestVital}
 onCreated={completeVisit}
 />
 )}
 </div>
 </MainLayout>
 );
}

function ClinicalBlock({ title, rows }) {
 return (
 <div style={{ border: "1px solid #e3ebf5", borderRadius: 8, padding: 12 }}>
 <div style={{ fontWeight: 900, color: "#162235", marginBottom: 8 }}>{title}</div>
 <div style={{ display: "grid", gap: 6 }}>
 {rows.map(([label, value]) => (
 <div key={label} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, fontSize: 13 }}>
 <span style={{ color: "#6b778c", fontWeight: 800 }}>{label}</span>
 <span style={{ color: "#162235", whiteSpace: "pre-wrap" }}>{value || "-"}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
