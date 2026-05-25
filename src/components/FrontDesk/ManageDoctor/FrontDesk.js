import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../../utils/auth";
import MainLayout from "../../Layout/MainLayout";
import AppointmentList from "../../UserSide/AppointmentList";
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
} from "../../Workflow/ClinicUi";

export default function FrontDesk() {
 const navigate = useNavigate();
 const [appointments, setAppointments] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 const load = useCallback(async () => {
 setLoading(true);
 setError("");
 try {
 const response = await authFetch(`/appointments?date=${todayISO()}&limit=100`);
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.message || "Failed to load frontdesk data.");
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

 const stats = useMemo(() => {
 return appointments.reduce(
 (acc, item) => {
 acc.total += 1;
 acc[item.status] = (acc[item.status] || 0) + 1;
 return acc;
 },
 { total: 0, PENDING: 0, CONFIRMED: 0, IN_QUEUE: 0, COMPLETED: 0 }
 );
 }, [appointments]);

 const priority = appointments.filter((item) => ["PENDING", "CONFIRMED"].includes(item.status));

 return (
 <MainLayout pageTitle="Frontdesk Dashboard" pageSubtitle="Confirm appointments, coordinate check-in, and hand off to cashier">
 <div style={{ display: "grid", gap: 14 }}>
 <ErrorState message={error} />

 <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
 <Metric label="Today" value={stats.total} />
 <Metric label="Pending Confirmation" value={stats.PENDING} />
 <Metric label="Ready for Cashier" value={stats.CONFIRMED} />
 <Metric label="In Queue" value={stats.IN_QUEUE} />
 </div>

 <Panel style={{ overflow: "hidden" }}>
 <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
 <div>
 <div style={{ fontWeight: 900, color: "#162235" }}>Today Priority</div>
 <div style={{ color: "#6b778c", fontSize: 12 }}>Confirm pending appointments before cashier billing.</div>
 </div>
 <div style={{ display: "flex", gap: 8 }}>
 <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
 <ActionButton onClick={() => navigate("/frontdesk/appointments")}>All Appointments</ActionButton>
 </div>
 </div>

 {loading ? (
 <LoadingState label="Loading appointments..." />
 ) : priority.length === 0 ? (
 <EmptyState title="No frontdesk actions pending" detail="Confirmed appointments can proceed to cashier payment." />
 ) : (
 <div style={{ overflowX: "auto" }}>
 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
 <thead>
 <tr style={{ background: "#f7fafd", color: "#65758b" }}>
 {["Time", "Patient", "Doctor", "Specialty", "Status"].map((heading) => (
 <th key={heading} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, textTransform: "uppercase" }}>{heading}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {priority.map((item) => (
 <tr key={item.id} style={{ borderTop: "1px solid #eef3f9" }}>
 <td style={{ padding: "12px 14px", fontWeight: 900 }}>{formatTime(item.time)}</td>
 <td style={{ padding: "12px 14px" }}>
 <strong>{item.patient_name}</strong>
 <div style={{ color: "#6b778c", fontSize: 12 }}>{formatDate(item.date)}</div>
 </td>
 <td style={{ padding: "12px 14px" }}>{item.doctor_name || "-"}</td>
 <td style={{ padding: "12px 14px" }}>{item.specialty_name || "-"}</td>
 <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </Panel>

 <AppointmentList />
 </div>
 </MainLayout>
 );
}

function Metric({ label, value }) {
 return (
 <Panel style={{ padding: 16 }}>
 <div style={{ color: "#6b778c", fontSize: 12, fontWeight: 900 }}>{label}</div>
 <div style={{ color: "#162235", fontSize: 28, fontWeight: 900, marginTop: 4 }}>{value}</div>
 </Panel>
 );
}
