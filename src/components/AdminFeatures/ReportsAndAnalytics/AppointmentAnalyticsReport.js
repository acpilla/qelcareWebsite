import React, { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const SUMMARY_CARDS = [
 { label: "Total Appointments", value: "3,420" },
 { label: "Completed", value: "2,984" },
 { label: "Cancelled", value: "218" },
 { label: "Avg. Daily", value: "114" },
];

const TABLE_ROWS = [
 { dept: "General Medicine", scheduled: 840, completed: 760, cancelled: 40 },
 { dept: "Pediatrics", scheduled: 620, completed: 551, cancelled: 28 },
 { dept: "Cardiology", scheduled: 470, completed: 421, cancelled: 19 },
 { dept: "Orthopedics", scheduled: 390, completed: 346, cancelled: 26 },
];

function useBarChart(canvasRef) {
 useEffect(() => {
 const ctx = canvasRef.current.getContext("2d");
 const chart = new Chart(ctx, {
 type: "bar",
 data: {
 labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
 datasets: [{
 label: "Appointments",
 data: [420, 510, 560, 620, 640, 670],
 borderWidth: 1,
 }],
 },
 options: { responsive: true, maintainAspectRatio: false },
 });
 return () => chart.destroy();
 }, [canvasRef]);
}

function useLineChart(canvasRef) {
 useEffect(() => {
 const ctx = canvasRef.current.getContext("2d");
 const chart = new Chart(ctx, {
 type: "line",
 data: {
 labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
 datasets: [{
 label: "Daily Activity",
 data: [90, 108, 115, 121, 132, 78],
 borderWidth: 3,
 fill: false,
 }],
 },
 options: { responsive: true, maintainAspectRatio: false },
 });
 return () => chart.destroy();
 }, [canvasRef]);
}

function exportTableCSV() {
 const headers = ["Department", "Scheduled", "Completed", "Cancelled"];
 const rows = TABLE_ROWS.map(r =>
 [r.dept, r.scheduled, r.completed, r.cancelled].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
 );
 const csv = [headers.join(","),...rows].join("\n");
 const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
 const link = document.createElement("a");
 link.href = URL.createObjectURL(blob);
 link.download = "appointment-analytics-report.csv";
 link.click();
}

function downloadCanvas(canvasRef, filename) {
 const link = document.createElement("a");
 link.download = filename;
 link.href = canvasRef.current.toDataURL("image/png");
 link.click();
}

export default function AppointmentAnalytics() {
 const barRef = useRef(null);
 const lineRef = useRef(null);

 useBarChart(barRef);
 useLineChart(lineRef);

 function downloadCharts() {
 downloadCanvas(barRef, "appointment-analytics-chart-1.png");
 setTimeout(() => downloadCanvas(lineRef, "appointment-analytics-chart-2.png"), 300);
 }

 return (
 <div style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#e5e7eb", color: "#111827", minHeight: "100vh" }}>

 <div style={{ background: "#163b6b", color: "#fff", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 10, fontWeight: 700, fontSize: "1.9rem" }}>
 <a href="#" style={{ position: "absolute", left: 20, color: "#fff", textDecoration: "none", fontSize: "1rem", fontWeight: 700 }}>{"<- Back"}</a>
 Analytics Reports
 </div>

 <div style={{ width: "min(1180px, 94%)", margin: "26px auto 40px" }}>

 {/* Header */}
 <div style={{ textAlign: "center", marginBottom: 20 }}>
 <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Appointment Analytics Report</h1>
 <p style={{ color: "#334155", fontSize: "1.02rem" }}>Monthly and daily appointment trends and activity.</p>
 </div>

 {/* Toolbar */}
 <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", margin: "20px 0 24px" }}>
 <ToolBtn onClick={() => window.print()}>Print / Export PDF</ToolBtn>
 <ToolBtn onClick={exportTableCSV}>Export Table CSV</ToolBtn>
 <ToolBtn onClick={downloadCharts}>Download Charts</ToolBtn>
 </div>

 {/* Summary Cards */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
 {SUMMARY_CARDS.map(card => (
 <div key={card.label} style={{ background: "#f8fafc", borderRadius: 14, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", borderLeft: "6px solid #163b6b" }}>
 <h3 style={{ fontSize: "0.98rem", color: "#475569", marginBottom: 8 }}>{card.label}</h3>
 <div style={{ fontSize: "1.9rem", fontWeight: 700, color: "#0f172a" }}>{card.value}</div>
 </div>
 ))}
 </div>

 {/* Charts */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18, marginBottom: 20 }}>
 <div style={chartCard}>
 <h2 style={chartTitle}>Monthly Appointment Trend</h2>
 <div style={{ position: "relative", height: 320 }}>
 <canvas ref={barRef} />
 </div>
 </div>
 <div style={chartCard}>
 <h2 style={chartTitle}>Daily Appointment Activity</h2>
 <div style={{ position: "relative", height: 320 }}>
 <canvas ref={lineRef} />
 </div>
 </div>
 </div>

 {/* Table */}
 <div style={chartCard}>
 <h2 style={chartTitle}>Detailed Report View</h2>
 <table style={{ width: "100%", borderCollapse: "collapse" }}>
 <thead>
 <tr>
 {["Department", "Scheduled", "Completed", "Cancelled"].map(h => (
 <th key={h} style={{ padding: 12, borderBottom: "1px solid #dbe3ea", textAlign: "left", fontSize: "0.96rem", background: "#edf2f7", color: "#163b6b" }}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {TABLE_ROWS.map(row => (
 <tr key={row.dept}>
 <td style={td}>{row.dept}</td>
 <td style={td}>{row.scheduled}</td>
 <td style={td}>{row.completed}</td>
 <td style={td}>{row.cancelled}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Footer */}
 <div style={{ textAlign: "center", color: "#64748b", marginTop: 14, fontSize: "0.95rem" }}>
 This is a viewable and exportable sample analytics report page for a hospital management system.
 </div>
 </div>
 </div>
 );
}

function ToolBtn({ onClick, children }) {
 const [hovered, setHovered] = React.useState(false);
 return (
 <button
 onClick={onClick}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 style={{ border: "none", background: hovered ? "#0f2f57" : "#163b6b", color: "#fff", padding: "12px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
 >
 {children}
 </button>
 );
}

const chartCard = {
 background: "#f8fafc", borderRadius: 14, padding: 18,
 boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const chartTitle = {
 fontSize: "1.2rem", marginBottom: 14, color: "#163b6b",
};

const td = {
 padding: 12, borderBottom: "1px solid #dbe3ea",
 textAlign: "left", fontSize: "0.96rem",
};