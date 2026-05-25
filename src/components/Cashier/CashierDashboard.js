// FILE: src/components/Cashier/CashierDashboard.js
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/auth";
import MainLayout from "../Layout/MainLayout";

// --- Helpers ------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(str) {
  if (!str) return "-";
  const [h, min] = str.split(":").map(Number);
  const d = new Date(); d.setHours(h, min, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_POOL = [
  ["#163a6b","#2f6fed"],["#1f7a6f","#2a9a8d"],["#7a1827","#b32042"],
  ["#5a3a8a","#7b52b5"],["#a56a00","#d98b20"],["#1a6b5a","#2a9b82"],
];
const avatarGrad = (id) => AVATAR_POOL[(id || 0) % AVATAR_POOL.length];

// --- Stat Card ----------------------------------------------------------------

function StatCard({ label, value, sub, accent, icon, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && onClick ? "#f4f8ff" : "#fff",
        border: "1px solid #e4ecf5", borderRadius: 18,
        padding: "22px 24px",
        boxShadow: hover && onClick
          ? "0 8px 28px rgba(22,58,107,.12)"
          : "0 2px 8px rgba(15,23,42,.05)",
        display: "flex", gap: 18, alignItems: "flex-start",
        cursor: onClick ? "pointer" : "default",
        transition: ".15s ease",
        transform: hover && onClick ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: `${accent}16`, display: "grid", placeItems: "center",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8a97a8", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#0f2744", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#aab4c0", marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  );
}

// --- Queue Row ----------------------------------------------------------------

const STATUS_META = {
  PENDING:     { label: "Pending",   bg: "#fff6e5", color: "#a56a00" },
  CONFIRMED:   { label: "Confirmed", bg: "#eaf6ef", color: "#1f7a52" },
  COMPLETED:   { label: "Completed", bg: "#eef3fb", color: "#163a6b" },
  CANCELLED:   { label: "Cancelled", bg: "#fff0f0", color: "#b94949" },
  RESCHEDULED: { label: "Rescheduled", bg: "#f5eeff", color: "#5a3a8a" },
};

// --- Main Component -----------------------------------------------------------

export default function CashierDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await authFetch("/appointments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setAppointments(data.appointments || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = todayISO();

  const stats = useMemo(() => {
    const todayAppts    = appointments.filter((a) => (a.date || "").split("T")[0] === today);
    const completed     = todayAppts.filter((a) => a.status === "COMPLETED");
    const pending       = todayAppts.filter((a) => ["PENDING","CONFIRMED"].includes(a.status));
    const cancelled     = todayAppts.filter((a) => a.status === "CANCELLED");
    return {
      todayTotal: todayAppts.length,
      completed:  completed.length,
      pending:    pending.length,
      cancelled:  cancelled.length,
    };
  }, [appointments, today]);

  // Today's upcoming queue (CONFIRMED only, sorted by time)
  const todayQueue = useMemo(() => {
    return appointments
      .filter((a) =>
        (a.date || "").split("T")[0] === today &&
        ["CONFIRMED","PENDING"].includes(a.status)
      )
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [appointments, today]);

  // Recent completed visits
  const recentCompleted = useMemo(() => {
    return appointments
      .filter((a) => a.status === "COMPLETED")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [appointments]);

  const now = new Date().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <MainLayout pageTitle="Cashier Dashboard" pageSubtitle={`Today is ${now}`}>

      {/* -- Stat Cards -- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard
          label="Today's Appointments" value={loading ? "..." : stats.todayTotal}
          sub="Total scheduled today" accent="#163a6b"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#163a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="Pending Payment" value={loading ? "..." : stats.pending}
          sub="Awaiting settlement" accent="#a56a00"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a56a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          onClick={() => navigate("/cashier/billing")}
        />
        <StatCard
          label="Completed Visits" value={loading ? "..." : stats.completed}
          sub="Done today" accent="#1f7a52"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f7a52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatCard
          label="Cancelled Today" value={loading ? "..." : stats.cancelled}
          sub="No charge required" accent="#b94949"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b94949" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
      </div>

      {/* -- Two-column layout -- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Today's Queue */}
        <div style={{
          background: "#fff", border: "1px solid #e4ecf5", borderRadius: 20,
          boxShadow: "0 4px 18px rgba(15,23,42,.06)", overflow: "hidden",
        }}>
          <div style={{
            padding: "18px 22px", borderBottom: "1px solid #eef3f9",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2744" }}>Today's Queue</div>
              <div style={{ fontSize: 12, color: "#8a97a8", marginTop: 2 }}>
                Active & pending appointments
              </div>
            </div>
            <button onClick={() => navigate("/cashier/billing")} style={{
              height: 34, padding: "0 14px", border: "1.5px solid #163a6b",
              borderRadius: 8, background: "#eef3fb", color: "#163a6b",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              View All
            </button>
          </div>

          {error && (
            <div style={{ margin: "12px 22px", padding: "10px 14px", background: "#fff0f0",
              border: "1px solid #fcc", borderRadius: 8, fontSize: 13, color: "#c0392b", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>}
            {!loading && todayQueue.length === 0 && (
              <div style={{ padding: "40px 22px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                <div style={{ fontWeight: 700, color: "#0f2744", fontSize: 15 }}>Queue is clear</div>
                <div style={{ color: "#8a97a8", fontSize: 13, marginTop: 4 }}>No pending appointments for today.</div>
              </div>
            )}
            {!loading && todayQueue.map((a, i) => {
              const sm = STATUS_META[a.status] || STATUS_META.PENDING;
              const [g1, g2] = avatarGrad(a.patient_id);
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 22px",
                  borderBottom: i < todayQueue.length - 1 ? "1px solid #f0f5fb" : "none",
                  transition: "background .12s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fafd")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg,${g1},${g2})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 12,
                    border: "2px solid #fff", boxShadow: "0 2px 6px rgba(15,23,42,.1)",
                  }}>
                    {getInitials(a.patient_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f2744", fontSize: 13 }}>{a.patient_name}</div>
                    <div style={{ fontSize: 11, color: "#8a97a8", marginTop: 2 }}>
                      {a.doctor_name} - {formatTime(a.time)}
                    </div>
                  </div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 99,
                    fontSize: 11, fontWeight: 700,
                    background: sm.bg, color: sm.color, flexShrink: 0,
                  }}>
                    {sm.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Completed */}
        <div style={{
          background: "#fff", border: "1px solid #e4ecf5", borderRadius: 20,
          boxShadow: "0 4px 18px rgba(15,23,42,.06)", overflow: "hidden",
        }}>
          <div style={{
            padding: "18px 22px", borderBottom: "1px solid #eef3f9",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2744" }}>Recent Completed Visits</div>
              <div style={{ fontSize: 12, color: "#8a97a8", marginTop: 2 }}>Last 6 completed consultations</div>
            </div>
            <span style={{
              padding: "3px 10px", borderRadius: 99,
              background: "#eef3fb", color: "#163a6b",
              fontSize: 11, fontWeight: 700,
            }}>
              {recentCompleted.length} records
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>}
            {!loading && recentCompleted.length === 0 && (
              <div style={{ padding: "40px 22px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#0f2744", fontSize: 15 }}>No completed visits yet</div>
                <div style={{ color: "#8a97a8", fontSize: 13, marginTop: 4 }}>Completed visits will show here.</div>
              </div>
            )}
            {!loading && recentCompleted.map((a, i) => {
              const [g1, g2] = avatarGrad(a.patient_id);
              const dateStr  = (a.date || "").split("T")[0];
              const [y, m, d] = dateStr ? dateStr.split("-").map(Number) : [0,0,0];
              const label    = dateStr
                ? new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "-";
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 22px",
                  borderBottom: i < recentCompleted.length - 1 ? "1px solid #f0f5fb" : "none",
                  transition: "background .12s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fafd")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg,${g1},${g2})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 12,
                    border: "2px solid #fff", boxShadow: "0 2px 6px rgba(15,23,42,.1)",
                  }}>
                    {getInitials(a.patient_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f2744", fontSize: 13 }}>{a.patient_name}</div>
                    <div style={{ fontSize: 11, color: "#8a97a8", marginTop: 2 }}>{a.doctor_name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#8a97a8", flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "#0f2744" }}>{label}</div>
                    <div style={{ marginTop: 2 }}>{formatTime(a.time)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* -- Quick Actions -- */}
      <div style={{
        marginTop: 20, background: "#fff", border: "1px solid #e4ecf5",
        borderRadius: 20, padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(15,23,42,.05)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f2744", marginRight: 4 }}>Quick Actions</div>
        {[
          { label: "Open Billing",          path: "/cashier/billing",  accent: "#163a6b" },
          { label: "View All Appointments", path: "/cashier/billing",  accent: "#1f7a52" },
        ].map((btn) => (
          <button key={btn.label} onClick={() => navigate(btn.path)} style={{
            height: 40, padding: "0 18px", border: "none", borderRadius: 10,
            background: `linear-gradient(90deg,${btn.accent}ee,${btn.accent})`,
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: `0 4px 14px ${btn.accent}44`,
          }}>
            {btn.label}
          </button>
        ))}
        <button onClick={load} style={{
          height: 40, padding: "0 14px", border: "1.5px solid #dde6f0",
          borderRadius: 10, background: "#fff", color: "#66778a",
          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

    </MainLayout>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%",
        border: "3px solid #eef3fb", borderTopColor: "#163a6b",
        animation: "spin .7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}