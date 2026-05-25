import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const SUMMARY_CARDS = [
 { label: "Total Records", value: "8,912" },
 { label: "Uploads This Month", value: "1,124" },
 { label: "Most Used Type", value: "Lab Results" },
 { label: "Storage Used", value: "12.4 GB" },
];

const TABLE_ROWS = [
 { type: "Lab Results", count: 3200, views: 8140, downloads: 2890 },
 { type: "Prescriptions", count: 2200, views: 6430, downloads: 2145 },
 { type: "Imaging", count: 1800, views: 4888, downloads: 1704 },
 { type: "Discharge Summary", count: 1712, views: 4021, downloads: 1389 },
];

function useLineChart(canvasRef) {
 useEffect(() => {
 const ctx = canvasRef.current.getContext("2d");
 const chart = new Chart(ctx, {
 type: "line",
 data: {
 labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
 datasets: [{
 label: "Uploaded Records",
 data: [820, 940, 1010, 1065, 1118, 1124],
 borderWidth: 3,
 fill: false,
 }],
 },
 options: { responsive: true, maintainAspectRatio: false },
 });
 return () => chart.destroy();
 }, [canvasRef]);
}

function useDoughnutChart(canvasRef) {
 useEffect(() => {
 const ctx = canvasRef.current.getContext("2d");
 const chart = new Chart(ctx, {
 type: "doughnut",
 data: {
 labels: ["Lab Results", "Prescriptions", "Imaging", "Discharge Summary"],
 datasets: [{
 label: "Documents",
 data: [3200, 2200, 1800, 1712],
 borderWidth: 1,
 }],
 },
 options: { responsive: true, maintainAspectRatio: false },
 });
 return () => chart.destroy();
 }, [canvasRef]);
}

function exportTableCSV() {
 const headers = ["Document Type", "Count", "Views", "Downloads"];
 const rows = TABLE_ROWS.map(r =>
 [r.type, r.count, r.views, r.downloads].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
 );
 const csv = [headers.join(","),...rows].join("\n");
 const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
 const link = document.createElement("a");
 link.href = URL.createObjectURL(blob);
 link.download = "medical-records-summary-report.csv";
 link.click();
}

function downloadCanvas(canvasRef, filename) {
 const link = document.createElement("a");
 link.download = filename;
 link.href = canvasRef.current.toDataURL("image/png");
 link.click();
}

export default function MedicalRecordsSummaryReport() {
 const lineRef = useRef(null);
 const doughnutRef = useRef(null);

 useLineChart(lineRef);
 useDoughnutChart(doughnutRef);

 function downloadCharts() {
 downloadCanvas(lineRef, "medical-records-summary-chart-1.png");
 setTimeout(() => downloadCanvas(doughnutRef, "medical-records-summary-chart-2.png"), 300);
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
 <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Medical Records Summary Report</h1>
 <p style={{ color: "#334155", fontSize: "1.02rem" }}>Total uploaded medical records and document usage.</p>
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
 <h2 style={chartTitle}>Monthly Record Uploads</h2>
 <div style={{ position: "relative", height: 320 }}>
 <canvas ref={lineRef} />
 </div>
 </div>
 <div style={chartCard}>
 <h2 style={chartTitle}>Document Type Usage</h2>
 <div style={{ position: "relative", height: 320 }}>
 <canvas ref={doughnutRef} />
 </div>
 </div>
 </div>

 {/* Table */}
 <div style={chartCard}>
 <h2 style={chartTitle}>Detailed Report View</h2>
 <table style={{ width: "100%", borderCollapse: "collapse" }}>
 <thead>
 <tr>
 {["Document Type", "Count", "Views", "Downloads"].map(h => (
 <th key={h} style={{ padding: 12, borderBottom: "1px solid #dbe3ea", textAlign: "left", fontSize: "0.96rem", background: "#edf2f7", color: "#163b6b" }}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {TABLE_ROWS.map(row => (
 <tr key={row.type}>
 <td style={td}>{row.type}</td>
 <td style={td}>{row.count}</td>
 <td style={td}>{row.views}</td>
 <td style={td}>{row.downloads}</td>
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
 const [hovered, setHovered] = useState(false);
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
