// FILE: src/components/QueueDisplay/QueueDisplayScreen.js
//
// LOBBY TV DISPLAY - No login required. Public route.
// Access: /lobby/live-queue-display
// Mount this on a TV/monitor in the clinic waiting area.
//
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5001";

// """ Palette """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
const C = {
  bg:        "#06111f",
  panel:     "#0b1e33",
  panelBdr:  "#132d4a",
  blue:      "#1a6dcc",
  blueL:     "#2281f0",
  green:     "#14a05a",
  amber:     "#d4900a",
  muted:     "#4a6080",
  mutedL:    "#7a96b4",
  white:     "#ffffff",
  textSub:   "#8ba8c4",
};

// """ Specialty colors """""""""""""""""""""""""""""""""""""""""""""""""""""""""
const SPEC_COLORS = [
  "#1a6dcc","#14a05a","#c47c0a","#7c3abf","#0a9e8a","#cc3a1a","#0a6ecc","#9e7a0a",
];

const TICKER_MESSAGES = [
  "Please proceed to the consultation room when your number is called.",
  "Kindly keep your PhilHealth / HMO card ready for presentation.",
  "For concerns, please approach the reception desk.",
  "Thank you for choosing QELCare Clinic. We value your health.",
];

// """ Clock component """"""""""""""""""""""""""""""""""""""""""""""""""""""""""
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 38, fontWeight: 800, color: C.white, letterSpacing: "-.02em", lineHeight: 1 }}>
        {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 13, color: C.textSub, marginTop: 4, fontWeight: 500 }}>
        {time.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

// """ Pulse animation for NOW SERVING """""""""""""""""""""""""""""""""""""""""
const PULSE_CSS = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .6; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ticker {
    0%   { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { display: none; }
`;

// """ Department card """"""""""""""""""""""""""""""""""""""""""""""""""""""""""
function DeptCard({ specialty, color, nowServing, nextUp, waitingCount }) {
  return (
    <div style={{
      background: C.panel,
      border: `1.5px solid ${C.panelBdr}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 14,
      padding: "22px 24px",
      animation: "slideIn .4s ease",
    }}>
      {/* Dept name */}
      <div style={{
        fontSize: 13, fontWeight: 800, color: color,
        textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 20,
      }}>
        {specialty}
      </div>

      {/* NOW SERVING */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>
          Now Serving
        </div>
        {nowServing ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
          }}>
            {/* Big queue number */}
            <div style={{
              width: 80, height: 80, borderRadius: 14,
              background: `${color}22`,
              border: `2px solid ${color}66`,
              display: "grid", placeItems: "center",
              animation: "pulse 2s infinite",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: color, lineHeight: 1 }}>
                {nowServing.queue_number}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 4 }}>
                {nowServing.patient_name}
              </div>
              <div style={{ fontSize: 12, color: C.textSub }}>
                Please proceed to the {specialty} consultation room
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            height: 80, borderRadius: 14,
            background: "#0a1826",
            display: "grid", placeItems: "center",
            border: `1px dashed ${C.panelBdr}`,
          }}>
            <span style={{ fontSize: 13, color: C.muted }}>No active patient</span>
          </div>
        )}
      </div>

      {/* NEXT UP */}
      {nextUp.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>
            Next in Line
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nextUp.map(n => (
              <div key={n.queue_id} style={{
                background: "#0a1826",
                border: `1px solid ${C.panelBdr}`,
                borderRadius: 9,
                padding: "8px 14px",
                textAlign: "center",
                minWidth: 52,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{n.queue_number}</div>
                <div style={{ fontSize: 10, color: C.textSub, marginTop: 2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.patient_name?.split(" ")[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.panelBdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted }}>
          {waitingCount} patient{waitingCount !== 1 ? "s" : ""} waiting
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 9px",
          borderRadius: 99,
          background: waitingCount > 0 ? `${color}18` : "#0a1826",
          color: waitingCount > 0 ? color : C.muted,
        }}>
          {waitingCount > 0 ? "- ACTIVE" : "- CLEAR"}
        </span>
      </div>
    </div>
  );
}

// """ Announcement ticker """"""""""""""""""""""""""""""""""""""""""""""""""""""
function Ticker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % TICKER_MESSAGES.length), 8000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      background: C.blue,
      padding: "11px 28px",
      display: "flex", alignItems: "center", gap: 14,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap", opacity: .8 }}>
        ANNOUNCEMENT
      </span>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <span key={idx} style={{ fontSize: 13, color: "#fff", fontWeight: 500, animation: "slideIn .5s ease" }}>
          {TICKER_MESSAGES[idx]}
        </span>
      </div>
    </div>
  );
}

// """ Main component """""""""""""""""""""""""""""""""""""""""""""""""""""""""""
export default function QueueDisplayScreen() {
  const [queueData,   setQueueData]   = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [error,       setError]       = useState(false);

  const fetchDisplay = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/queue/display`);
      const data = await res.json();
      if (data.success) {
        setSpecialties(data.data.specialties);
        setQueueData(data.data.queue);
        setLastUpdate(new Date());
        setError(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisplay();
    const t = setInterval(fetchDisplay, 10_000); // refresh every 10s
    return () => clearInterval(t);
  }, [fetchDisplay]);

  // "" Build per-specialty view """"""""""""""""""""""""""""""""""""""""""""""""
  const deptViews = specialties.map((s, i) => {
    const entries     = queueData.filter(q => q.specialty_id === s.specialty_id);
    const nowServing  = entries.find(q => q.status === "IN_PROGRESS") || null;
    const nextUp      = entries.filter(q => q.status === "WAITING").slice(0, 4);
    const waitingCount = entries.filter(q => q.status === "WAITING").length;
    return { ...s, nowServing, nextUp, waitingCount, color: SPEC_COLORS[i % SPEC_COLORS.length] };
  }).filter(d => d.nowServing || d.waitingCount > 0); // only show active depts

  // """ Full screen layout """"""""""""""""""""""""""""""""""""""""""""""""""""
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "'Inter','Segoe UI',sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{PULSE_CSS}</style>

      {/* "" Header """"""""""""""""""""""""""""""""""""""""""""""""""""""""""" */}
      <div style={{
        background: C.panel,
        borderBottom: `1px solid ${C.panelBdr}`,
        padding: "18px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        {/* Logo / clinic name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "linear-gradient(135deg,#0a3d7a,#1a6dcc)",
            display: "grid", placeItems: "center",
            fontSize: 18, fontWeight: 900, color: "#fff",
          }}>Q</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: "-.01em" }}>QELCare Clinic</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Live Queue Display</div>
          </div>
        </div>

        {/* Clock */}
        <Clock />
      </div>

      {/* "" Body """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, color: C.textSub, marginBottom: 8 }}>Loading queue...</div>
              <div style={{ fontSize: 12, color: C.muted }}>Please wait</div>
            </div>
          </div>
        ) : error ? (
          <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, color: "#c0392b", marginBottom: 8 }}> Connection Error</div>
              <div style={{ fontSize: 13, color: C.muted }}>Unable to reach the server. Retrying...</div>
            </div>
          </div>
        ) : deptViews.length === 0 ? (
          <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}></div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>No Active Queue</div>
              <div style={{ fontSize: 14, color: C.textSub }}>All departments are currently clear.</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                Please register at the reception desk.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.muted,
              letterSpacing: ".12em", textTransform: "uppercase",
              marginBottom: 18,
            }}>
              Active Departments - {deptViews.length} serving today
            </div>

            {/* Grid - 1 col on narrow, 2 on medium, 3 on wide */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 18,
            }}>
              {deptViews.map(d => (
                <DeptCard
                  key={d.specialty_id}
                  specialty={d.specialty_name}
                  color={d.color}
                  nowServing={d.nowServing}
                  nextUp={d.nextUp}
                  waitingCount={d.waitingCount}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* "" Ticker """"""""""""""""""""""""""""""""""""""""""""""""""""""""""" */}
      <Ticker />

      {/* "" Footer """"""""""""""""""""""""""""""""""""""""""""""""""""""""""" */}
      <div style={{
        background: C.panel,
        borderTop: `1px solid ${C.panelBdr}`,
        padding: "8px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: C.muted }}>Auto-refreshes every 10 seconds</span>
        {lastUpdate && (
          <span style={{ fontSize: 11, color: C.muted }}>
            Last updated: {lastUpdate.toLocaleTimeString("en-PH")}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.muted }}>Copyright 2026 QELCare Clinic Management System</span>
      </div>
    </div>
  );
}
