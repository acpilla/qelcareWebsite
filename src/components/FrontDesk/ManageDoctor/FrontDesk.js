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

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_QUEUE", "RESCHEDULED"];

export default function FrontDesk() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch("/appointments?limit=100");
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

  const today = todayISO();

  const stats = useMemo(() => {
    const todayRows = appointments.filter((item) => String(item.date || "").slice(0, 10) === today);
    return {
      totalActive: appointments.filter((item) => ACTIVE_STATUSES.includes(item.status)).length,
      today: todayRows.length,
      pending: appointments.filter((item) => item.status === "PENDING").length,
      todayQueue: todayRows.filter((item) => item.status === "IN_QUEUE").length,
      confirmedFuture: appointments.filter((item) => item.status === "CONFIRMED" && String(item.date || "").slice(0, 10) > today).length,
    };
  }, [appointments, today]);

  const priority = useMemo(() => {
    return appointments
      .filter((item) => ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status))
      .filter((item) => String(item.date || "").slice(0, 10) >= today)
      .sort((a, b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`))
      .slice(0, 10);
  }, [appointments, today]);

  async function updateStatus(appointment, nextStatus) {
    let cancelReason = "";
    if (nextStatus === "CANCELLED") {
      cancelReason = window.prompt("Cancellation reason:");
      if (!cancelReason || !cancelReason.trim()) return;
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

      setMessage(payload.message || `Appointment #${appointment.id} updated.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <MainLayout pageTitle="Frontdesk Dashboard" pageSubtitle="Approve appointments, check in today's confirmed patients, and manage cancellations or no-shows">
      <div style={{ display: "grid", gap: 14 }}>
        <ErrorState message={error} />
        {message && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>
            {message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
          <Metric label="Active Workload" value={stats.totalActive} />
          <Metric label="Today" value={stats.today} />
          <Metric label="Pending Approval" value={stats.pending} />
          <Metric label="Today Queue" value={stats.todayQueue} />
          <Metric label="Future Confirmed" value={stats.confirmedFuture} />
        </div>

        <Panel style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eef6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, color: "#162235" }}>Approval and Check-in Worklist</div>
              <div style={{ color: "#6b778c", fontSize: 12 }}>
                Same-day approvals enter the live queue. Future approvals stay confirmed until the appointment date.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ActionButton tone="secondary" onClick={load}>Refresh</ActionButton>
              <ActionButton onClick={() => navigate("/frontdesk/appointments")}>All Appointments</ActionButton>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading appointments..." />
          ) : priority.length === 0 ? (
            <EmptyState title="No frontdesk actions pending" detail="New booking requests and confirmed check-ins will appear here." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7fafd", color: "#65758b" }}>
                    {["Schedule", "Patient", "Doctor", "Specialty", "Status", "Action"].map((heading) => (
                      <th key={heading} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, textTransform: "uppercase" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priority.map((item) => {
                    const itemDate = String(item.date || "").slice(0, 10);
                    const isToday = itemDate === today;
                    return (
                      <tr key={item.id} style={{ borderTop: "1px solid #eef3f9" }}>
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 900, color: "#162235" }}>{formatDate(item.date)}</div>
                          <div style={{ color: "#6b778c", fontSize: 12 }}>{formatTime(item.time)}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ color: "#162235" }}>{item.patient_name}</strong>
                          <div style={{ color: "#6b778c", fontSize: 12 }}>{item.patient_phone || item.patient_email || ""}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>{item.doctor_name || "-"}</td>
                        <td style={{ padding: "12px 14px" }}>{item.specialty_name || "-"}</td>
                        <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {["PENDING", "RESCHEDULED"].includes(item.status) && (
                              <ActionButton disabled={savingId === item.id} tone="success" onClick={() => updateStatus(item, "CONFIRMED")}>
                                {isToday ? "Approve and Queue" : "Approve"}
                              </ActionButton>
                            )}
                            {item.status === "CONFIRMED" && isToday && (
                              <ActionButton disabled={savingId === item.id} onClick={() => updateStatus(item, "IN_QUEUE")}>Check In</ActionButton>
                            )}
                            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) && (
                              <ActionButton disabled={savingId === item.id} tone="danger" onClick={() => updateStatus(item, "CANCELLED")}>Cancel</ActionButton>
                            )}
                            {item.status === "CONFIRMED" && isToday && (
                              <ActionButton disabled={savingId === item.id} tone="warning" onClick={() => updateStatus(item, "NO_SHOW")}>No Show</ActionButton>
                            )}
                            {item.status === "CONFIRMED" && !isToday && (
                              <span style={{ color: "#6b778c", fontSize: 12, alignSelf: "center" }}>Waiting for appointment date</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
