import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../utils/auth";
import { EmptyState, ErrorState, LoadingState, Panel, formatDate, getRows } from "../Workflow/ClinicUi";

export default function MedicationScreen() {
 const [records, setRecords] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 const load = useCallback(async () => {
 setLoading(true);
 setError("");
 try {
 const response = await authFetch("/medical-records/me");
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to load medications.");
 setRecords(getRows(payload, "records"));
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const medicationRecords = useMemo(() => {
 return records.map((record) => ({
 id: record.record_id || record.id,
 date: record.visit_date || record.appointment_date,
 doctor: record.doctor_name,
 diagnosis: record.diagnosis,
 prescription: record.prescriptions || record.prescription,
 treatment: record.treatment_plan,
 followUp: record.follow_up_date_text || record.follow_up_date,
 })).filter((record) => String(record.prescription || "").trim());
 }, [records]);

 return (
 <div style={{ display: "grid", gap: 14 }}>
 <ErrorState message={error} />
 <Panel style={{ overflow: "hidden" }}>
 <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6" }}>
 <div style={{ fontSize: 15, fontWeight: 900, color: "#162235" }}>My Medications</div>
 <div style={{ color: "#6b778c", fontSize: 12, marginTop: 2 }}>
 Prescription details from completed medical records.
 </div>
 </div>

 {loading ? (
 <LoadingState label="Loading prescriptions..." />
 ) : medicationRecords.length === 0 ? (
 <EmptyState title="No prescriptions yet" detail="Doctor prescriptions will appear here after a completed consultation." />
 ) : (
 <div style={{ display: "grid" }}>
 {medicationRecords.map((item) => (
 <article key={item.id} style={{ padding: 16, borderTop: "1px solid #eef3f9", display: "grid", gap: 10 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <div>
 <div style={{ fontWeight: 900, color: "#162235" }}>{item.diagnosis || "Prescription"}</div>
 <div style={{ color: "#6b778c", fontSize: 13 }}>{item.doctor || "Doctor"} - {formatDate(item.date)}</div>
 </div>
 {item.followUp && (
 <div style={{ color: "#42526a", fontSize: 12, fontWeight: 800 }}>
 Follow-up: {formatDate(item.followUp)}
 </div>
 )}
 </div>
 <div style={{ border: "1px solid #e3ebf5", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", color: "#162235", lineHeight: 1.45 }}>
 {item.prescription}
 </div>
 {item.treatment && (
 <div style={{ color: "#42526a", fontSize: 13 }}>
 <strong>Treatment:</strong> {item.treatment}
 </div>
 )}
 </article>
 ))}
 </div>
 )}
 </Panel>
 </div>
 );
}
