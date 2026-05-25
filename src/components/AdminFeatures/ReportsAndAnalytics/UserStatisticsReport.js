import React, { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const styles = {
  body: {
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#e5e7eb",
    color: "#111827",
    minHeight: "100vh",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
  },
  topbar: {
    background: "#163b6b",
    color: "#fff",
    padding: "18px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 10,
    fontWeight: 700,
    fontSize: "1.9rem",
  },
  backLink: {
    position: "absolute",
    left: 20,
    color: "#fff",
    textDecoration: "none",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
  },
  container: {
    width: "min(1180px, 94%)",
    margin: "26px auto 40px",
  },
  headerBlock: {
    textAlign: "center",
    marginBottom: 20,
  },
  h1: {
    fontSize: "2rem",
    marginBottom: 8,
    margin: 0,
  },
  headerP: {
    color: "#334155",
    fontSize: "1.02rem",
    margin: 0,
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    margin: "20px 0 24px",
  },
  button: {
    border: "none",
    background: "#163b6b",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "1rem",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    borderLeft: "6px solid #163b6b",
  },
  summaryCardH3: {
    fontSize: "0.98rem",
    color: "#475569",
    marginBottom: 8,
    margin: "0 0 8px 0",
    fontWeight: 600,
  },
  summaryCardValue: {
    fontSize: "1.9rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 18,
    marginBottom: 20,
  },
  chartCard: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  tableCard: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  cardH2: {
    fontSize: "1.2rem",
    marginBottom: 14,
    color: "#163b6b",
    margin: "0 0 14px 0",
  },
  chartWrap: {
    position: "relative",
    height: 320,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: 12,
    borderBottom: "1px solid #dbe3ea",
    textAlign: "left",
    fontSize: "0.96rem",
    background: "#edf2f7",
    color: "#163b6b",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #dbe3ea",
    textAlign: "left",
    fontSize: "0.96rem",
  },
  footerNote: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 14,
    fontSize: "0.95rem",
  },
};

const summaryData = [
  { label: "Total Members", value: "1,248" },
  { label: "Dependents", value: "842" },
  { label: "Hospital Staff", value: "214" },
  { label: "New This Month", value: "96" },
];

const tableRows = [
  { category: "Members", total: 1248, active: 1180, inactive: 68 },
  { category: "Dependents", total: 842, active: 801, inactive: 41 },
  { category: "Staff", total: 214, active: 210, inactive: 4 },
  { category: "New Registrations", total: 96, active: 96, inactive: 0 },
];

export default function UserStatisticsReport() {
  const chartOneRef = useRef(null);
  const chartTwoRef = useRef(null);
  const chartOneInstance = useRef(null);
  const chartTwoInstance = useRef(null);

  useEffect(() => {
    if (chartOneRef.current) {
      if (chartOneInstance.current) chartOneInstance.current.destroy();
      chartOneInstance.current = new Chart(chartOneRef.current, {
        type: "line",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          datasets: [
            {
              label: "Registered Users",
              data: [120, 160, 190, 230, 260, 288],
              borderWidth: 3,
              fill: false,
              borderColor: "#163b6b",
              backgroundColor: "#163b6b",
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
    if (chartTwoRef.current) {
      if (chartTwoInstance.current) chartTwoInstance.current.destroy();
      chartTwoInstance.current = new Chart(chartTwoRef.current, {
        type: "bar",
        data: {
          labels: ["Members", "Dependents", "Staff"],
          datasets: [
            {
              label: "Total Count",
              data: [1248, 842, 214],
              borderWidth: 1,
              backgroundColor: "#163b6b",
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
    return () => {
      chartOneInstance.current?.destroy();
      chartTwoInstance.current?.destroy();
    };
  }, []);

  const exportTableCSV = () => {
    const headers = ["Category", "Total", "Active", "Inactive"];
    const rows = tableRows.map((r) =>
      [r.category, r.total, r.active, r.inactive]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "user-statistics-report.csv";
    link.click();
  };

  const downloadCanvas = (canvasRef, filename) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadCharts = () => {
    downloadCanvas(chartOneRef, "user-statistics-chart-1.png");
    setTimeout(() => downloadCanvas(chartTwoRef, "user-statistics-chart-2.png"), 300);
  };

  return (
    <div style={styles.body}>
      {/* Topbar */}
      <div style={styles.topbar}>
        <button style={styles.backLink} onClick={() => window.history.back()}>
          &larr; Back
        </button>
        Analytics Reports
      </div>

      {/* Main Container */}
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerBlock}>
          <h1 style={styles.h1}>User Statistics Report</h1>
          <p style={styles.headerP}>Overview of registered members, dependents, and staff.</p>
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button style={styles.button} onClick={() => window.print()}>
            Print / Export PDF
          </button>
          <button style={styles.button} onClick={exportTableCSV}>
            Export Table CSV
          </button>
          <button style={styles.button} onClick={downloadCharts}>
            Download Charts
          </button>
        </div>

        {/* Summary Cards */}
        <div style={styles.summaryGrid}>
          {summaryData.map((card) => (
            <div key={card.label} style={styles.summaryCard}>
              <h3 style={styles.summaryCardH3}>{card.label}</h3>
              <div style={styles.summaryCardValue}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={styles.chartsGrid}>
          <div style={styles.chartCard}>
            <h2 style={styles.cardH2}>User Registration Trend</h2>
            <div style={styles.chartWrap}>
              <canvas ref={chartOneRef} />
            </div>
          </div>
          <div style={styles.chartCard}>
            <h2 style={styles.cardH2}>User Category Distribution</h2>
            <div style={styles.chartWrap}>
              <canvas ref={chartTwoRef} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={styles.tableCard}>
          <h2 style={styles.cardH2}>Detailed Report View</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Inactive</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.category}>
                  <td style={styles.td}>{row.category}</td>
                  <td style={styles.td}>{row.total}</td>
                  <td style={styles.td}>{row.active}</td>
                  <td style={styles.td}>{row.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={styles.footerNote}>
          This is a viewable and exportable sample analytics report page for a hospital management system.
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          button { display: none !important; }
          body { background: #fff !important; }
        }
        @media (max-width: 900px) {
          .summary-grid, .charts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}