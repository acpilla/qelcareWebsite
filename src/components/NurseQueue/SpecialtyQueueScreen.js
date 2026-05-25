import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/auth";
import MainLayout from "../Layout/MainLayout";
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

const SPECIALTY_ALIASES = {
 cardio: "cardiology",
 gastro: "gastroenterology",
 "ob-gyne": "obstetrics-gynecology",
 obgyn: "obstetrics-gynecology",
 pediatrician: "pediatrics",
 rehab: "rehabilitation-medicine",
};

const blankVitals = {
 blood_pressure: "",
 heart_rate: "",
 temperature: "",
 weight: "",
 height: "",
 oxygen_sat: "",
 chief_complaint: "",
 nurse_notes: "",
};

function normalize(value) {
 return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function SpecialtyQueueScreen({ slug, specialtyName }) {
 const navigate = useNavigate();
 const targetSlug = SPECIALTY_ALIASES[slug] || slug;
 const [specialties, setSpecialties] = useState([]);
 const [queue, setQueue] = useState([]);
 const [selected, setSelected] = useState(null);
 const [vitals, setVitals] = useState(blankVitals);
 const [date, setDate] = useState(todayISO());
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");

 const specialty = useMemo(() => {
 return specialties.find((item) => {
 const direct = normalize(item.slug) === normalize(targetSlug);
 const byName = normalize(item.specialty_name) === normalize(targetSlug);
 const contains = normalize(item.specialty_name).includes(normalize(targetSlug));
 return direct || byName || contains;
 });
 }, [specialties, targetSlug]);

 const title = specialty?.specialty_name || specialtyName || targetSlug.replace(/-/g, " ");

 const load = useCallback(async () => {
 setLoading(true);
 setError("");
 try {
 const specsRes = await authFetch(`/queue/specialties?date=${date}`);
 const specsPayload = await specsRes.json();
 if (!specsRes.ok) throw new Error(specsPayload.message || "Failed to load specialties.");
 const specs = getRows(specsPayload, "specialties");
 setSpecialties(specs);

 const matched = specs.find((item) => {
 const direct = normalize(item.slug) === normalize(targetSlug);
 const byName = normalize(item.specialty_name) === normalize(targetSlug);
 const contains = normalize(item.specialty_name).includes(normalize(targetSlug));
 return direct || byName || contains;
 });

 if (!matched) {
 setQueue([]);
 return;
 }

 const queueRes = await authFetch(`/queue/specialty/${matched.specialty_id}?date=${date}`);
 const queuePayload = await queueRes.json();
 if (!queueRes.ok) throw new Error(queuePayload.message || "Failed to load queue.");
 setQueue(getRows(queuePayload, "queue"));
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 }, [date, targetSlug]);

 useEffect(() => {
 load();
 }, [load]);

 async function updateQueueStatus(entry, status) {
 setSaving(true);
 setError("");
 setMessage("");
 try {
 const response = await authFetch(`/queue/${entry.queue_id}/status`, {
 method: "PATCH",
 body: JSON.stringify({ status }),
 });
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to update queue.");
 setMessage(`Queue #${entry.queue_number} changed to ${status}.`);
 if (selected?.queue_id === entry.queue_id) setSelected(payload.queue_entry || payload.data);
 await load();
 } catch (err) {
 setError(err.message);
 } finally {
 setSaving(false);
 }
 }

 async function submitVitals(event) {
 event.preventDefault();
 if (!selected) return;
 setSaving(true);
 setError("");
 setMessage("");
 try {
 const response = await authFetch("/vitals", {
 method: "POST",
 body: JSON.stringify({
 patient_id: selected.patient_id,
 appointment_id: selected.appointment_id,...vitals,
 }),
 });
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to record vitals.");
 setMessage(`Vitals recorded for ${selected.patient_name}.`);
 setVitals(blankVitals);
 await load();
 } catch (err) {
 setError(err.message);
 } finally {
 setSaving(false);
 }
 }

 return (
 <MainLayout pageTitle={`${title} Queue`} pageSubtitle="Paid patients waiting for nurse assessment">
 <div style={{ display: "grid", gap: 14 }}>
 <Panel style={{ padding: 16 }}>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 170px auto auto", gap: 10, alignItems: "end" }}>
 <div>
 <div style={{ fontWeight: 900, color: "#162235" }}>{title}</div>
 <div style={{ color: "#6b778c", fontSize: 13 }}>Queue appears after cashier payment creates the queue entry.</div>
 </div>
 <Field label="Queue date">
 <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
 </Field>
 <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
 <ActionButton tone="secondary" onClick={() => navigate("/nurse/queue")}>All Queues</ActionButton>
 </div>
 </Panel>

 <ErrorState message={error} />
 {message && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{message}</div>}

 <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px,.9fr)", gap: 14, alignItems: "start" }}>
 <Panel style={{ overflow: "hidden" }}>
 <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6" }}>
 <div style={{ fontWeight: 900, color: "#162235" }}>Live Queue</div>
 <div style={{ color: "#6b778c", fontSize: 12 }}>{queue.length} patient(s)</div>
 </div>

 {loading ? (
 <LoadingState label="Loading queue..." />
 ) : !specialty ? (
 <EmptyState title="Specialty not found" detail="Run the workflow migration so this specialty exists." />
 ) : queue.length === 0 ? (
 <EmptyState title="No queued patients" detail="Confirmed appointments appear here after cashier payment." />
 ) : (
 <div style={{ display: "grid" }}>
 {queue.map((entry) => (
 <button
 key={entry.queue_id}
 type="button"
 onClick={() => {
 setSelected(entry);
 setVitals((current) => ({...current,
 chief_complaint: entry.chief_complaint || current.chief_complaint,
 }));
 }}
 style={{
 border: "none",
 borderTop: "1px solid #eef3f9",
 background: selected?.queue_id === entry.queue_id ? "#f2f7ff" : "#fff",
 padding: 14,
 cursor: "pointer",
 textAlign: "left",
 display: "grid",
 gridTemplateColumns: "72px 1fr auto",
 gap: 12,
 alignItems: "center",
 fontFamily: "inherit",
 }}
 >
 <div style={{ color: "#163a6b", fontSize: 24, fontWeight: 900 }}>#{entry.queue_number}</div>
 <div>
 <div style={{ fontWeight: 900, color: "#162235" }}>{entry.patient_name}</div>
 <div style={{ color: "#6b778c", fontSize: 12 }}>
 {formatDate(entry.appointment_date)} at {formatTime(entry.appointment_time)} - {entry.doctor_name || "Doctor"}
 </div>
 </div>
 <StatusBadge status={entry.status} />
 </button>
 ))}
 </div>
 )}
 </Panel>

 <Panel style={{ padding: 16 }}>
 {!selected ? (
 <EmptyState title="Select a queued patient" detail="Call the patient and record vitals from here." />
 ) : (
 <div style={{ display: "grid", gap: 14 }}>
 <div>
 <div style={{ fontSize: 20, fontWeight: 900, color: "#162235" }}>#{selected.queue_number} {selected.patient_name}</div>
 <div style={{ color: "#6b778c", fontSize: 13 }}>
 Appointment #{selected.appointment_id} - {selected.chief_complaint || "No complaint entered"}
 </div>
 </div>

 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 {selected.status !== "IN_PROGRESS" && selected.status !== "DONE" && (
 <ActionButton disabled={saving} onClick={() => updateQueueStatus(selected, "IN_PROGRESS")}>Call Patient</ActionButton>
 )}
 {selected.status === "SKIPPED" && (
 <ActionButton disabled={saving} tone="secondary" onClick={() => updateQueueStatus(selected, "WAITING")}>Return Waiting</ActionButton>
 )}
 {selected.status !== "DONE" && (
 <ActionButton disabled={saving} tone="warning" onClick={() => updateQueueStatus(selected, "SKIPPED")}>Skip</ActionButton>
 )}
 </div>

 <form onSubmit={submitVitals} style={{ display: "grid", gap: 10 }}>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
 <Field label="Blood pressure">
 <input style={inputStyle} value={vitals.blood_pressure} onChange={(e) => setVitals({...vitals, blood_pressure: e.target.value })} placeholder="120/80" />
 </Field>
 <Field label="Heart rate">
 <input style={inputStyle} value={vitals.heart_rate} onChange={(e) => setVitals({...vitals, heart_rate: e.target.value })} placeholder="bpm" />
 </Field>
 <Field label="Temperature">
 <input style={inputStyle} value={vitals.temperature} onChange={(e) => setVitals({...vitals, temperature: e.target.value })} placeholder="C" />
 </Field>
 <Field label="Oxygen sat">
 <input style={inputStyle} value={vitals.oxygen_sat} onChange={(e) => setVitals({...vitals, oxygen_sat: e.target.value })} placeholder="%" />
 </Field>
 <Field label="Weight">
 <input style={inputStyle} value={vitals.weight} onChange={(e) => setVitals({...vitals, weight: e.target.value })} placeholder="kg" />
 </Field>
 <Field label="Height">
 <input style={inputStyle} value={vitals.height} onChange={(e) => setVitals({...vitals, height: e.target.value })} placeholder="cm" />
 </Field>
 </div>
 <Field label="Chief complaint">
 <textarea style={{...inputStyle, minHeight: 68 }} value={vitals.chief_complaint} onChange={(e) => setVitals({...vitals, chief_complaint: e.target.value })} />
 </Field>
 <Field label="Nurse notes">
 <textarea style={{...inputStyle, minHeight: 68 }} value={vitals.nurse_notes} onChange={(e) => setVitals({...vitals, nurse_notes: e.target.value })} />
 </Field>
 <ActionButton type="submit" disabled={saving}>{saving ? "Saving..." : "Record Vitals"}</ActionButton>
 </form>
 </div>
 )}
 </Panel>
 </div>
 </div>
 </MainLayout>
 );
}