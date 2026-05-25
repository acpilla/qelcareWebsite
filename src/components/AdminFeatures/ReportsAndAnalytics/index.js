import React, { useMemo, useState } from "react";
import MainLayout from "../../Layout/MainLayout";
import { authFetch } from "../../../utils/auth";

const RANGE_OPTIONS = [
  { value: "past_7_days", label: "Past 7 Days" },
  { value: "past_30_days", label: "Past 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

const C = {
  navy: "#163a6b",
  navyDark: "#102f57",
  blue: "#2f6fed",
  teal: "#1f7a52",
  amber: "#a56a00",
  violet: "#5a3a8a",
  text: "#17212b",
  muted: "#66758a",
  line: "#d8e2ee",
  soft: "#f4f7fb",
  white: "#ffffff",
  red: "#b94949",
};

function intValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part, total) {
  if (!total) return "0%";
  return `${Math.round((intValue(part) / intValue(total)) * 100)}%`;
}

function formatDate(date) {
  if (!date) return "Not available";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getMetricCards(data) {
  const metrics = data?.metrics || {};
  const department = data?.highlights?.most_visited_department;
  const busiestDay = data?.highlights?.busiest_day;
  const totalAppointments = intValue(metrics.total_appointments);
  const completedVisits = intValue(metrics.completed_visits);
  const queueEntries = intValue(metrics.queue_entries);

  return [
    {
      label: "Total Appointments",
      value: totalAppointments,
      sub: `${intValue(metrics.confirmed_appointments)} confirmed, ${intValue(metrics.pending_appointments)} pending`,
      accent: C.navy,
    },
    {
      label: "Completed Visits",
      value: completedVisits,
      sub: `${pct(completedVisits, totalAppointments)} completion rate`,
      accent: C.teal,
    },
    {
      label: "Queue Entries",
      value: queueEntries,
      sub: "Recorded queue activity",
      accent: C.amber,
    },
    {
      label: "Most Visited Department",
      value: department?.department || "None",
      sub: department ? `${intValue(department.total)} appointment${intValue(department.total) === 1 ? "" : "s"}` : "No department data",
      accent: C.violet,
    },
    {
      label: "Busiest Day",
      value: busiestDay?.day_name || "None",
      sub: busiestDay ? `${intValue(busiestDay.total)} ${busiestDay.source === "queue" ? "queue entries" : "appointments"}` : "No day data",
      accent: C.blue,
    },
  ];
}

function AnalyticsReports() {
  const [range, setRange] = useState("past_7_days");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insights, setInsights] = useState(null);

  const cards = useMemo(() => getMetricCards(insights), [insights]);
  const report = insights?.report;

  const generateInsights = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch(`/analytics/ai-insights?range=${encodeURIComponent(range)}`);
      if (!response?.ok) {
        const payload = response ? await response.json().catch(() => ({})) : {};
        throw new Error(payload.message || "Failed to generate AI insights.");
      }

      const payload = await response.json();
      setInsights(payload.data || null);
    } catch (err) {
      setError(err.message || "Failed to generate AI insights.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout pageTitle="Reports & Analytics" pageSubtitle="AI-assisted clinic operations reporting">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <section style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          padding: 22,
          boxShadow: "0 2px 8px rgba(15,23,42,.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Admin Analytics
              </div>
              <h1 style={{ margin: "5px 0 6px", color: C.text, fontSize: 26, lineHeight: 1.2 }}>
                AI Insights Report
              </h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.55, maxWidth: 720 }}>
                Generate a clinic operations summary from appointment, department, and queue activity.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
                disabled={loading}
                style={{
                  height: 42,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: "0 12px",
                  color: C.text,
                  background: C.white,
                  fontWeight: 700,
                  minWidth: 160,
                }}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={generateInsights}
                disabled={loading}
                style={{
                  height: 42,
                  border: `1px solid ${C.navy}`,
                  borderRadius: 8,
                  padding: "0 16px",
                  background: loading ? "#7389a6" : C.navy,
                  color: "#fff",
                  fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Generating..." : "Generate Ollama Insights"}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div style={{
            background: "#fff2f4",
            color: C.red,
            border: "1px solid #f7c5cb",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 700,
          }}>
            {error}
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />)
          ) : (
            cards.map((card) => <MetricCard key={card.label} card={card} />)
          )}
        </section>

        <section style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, .85fr)",
          gap: 18,
          alignItems: "start",
        }}>
          <div style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            minHeight: 390,
            boxShadow: "0 2px 8px rgba(15,23,42,.04)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}` }}>
              <h2 style={{ margin: 0, color: C.text, fontSize: 18 }}>Generated Report</h2>
              <p style={{ margin: "5px 0 0", color: C.muted, fontSize: 13 }}>
                {insights ? `${formatDate(insights.range?.startDate)} to ${formatDate(insights.range?.endDate)} / ${insights.source === "ollama" ? "Ollama" : "Built-in fallback"}${insights.fallback_reason ? ` - ${insights.fallback_reason}` : ""}` : "Select a range and generate insights."}
              </p>
            </div>

            <div style={{ padding: 20 }}>
              {loading ? (
                <ReportSkeleton />
              ) : report ? (
                <ReportContent report={report} />
              ) : (
                <EmptyReport />
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <BreakdownPanel
              title="Department Visits"
              empty="No department activity in this period."
              rows={insights?.charts?.departments || []}
              labelKey="department"
              valueKey="total"
              accent={C.violet}
            />
            <BreakdownPanel
              title="Clinic Days"
              empty="No appointment activity in this period."
              rows={insights?.charts?.appointments_by_day || []}
              labelKey="day_name"
              valueKey="total"
              accent={C.blue}
            />
            <BreakdownPanel
              title="Queue Activity"
              empty="No queue activity in this period."
              rows={insights?.charts?.queue_by_day || []}
              labelKey="day_name"
              valueKey="total"
              accent={C.amber}
            />
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 1180px) {
          section[style*="repeat(5"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          section[style*="1.15fr"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          section[style*="repeat(5"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </MainLayout>
  );
}

function MetricCard({ card }) {
  return (
    <article style={{
      background: C.white,
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      padding: 16,
      minHeight: 118,
      boxShadow: "0 2px 8px rgba(15,23,42,.04)",
      borderTop: `4px solid ${card.accent}`,
      minWidth: 0,
    }}>
      <div style={{ color: C.muted, fontSize: 12, fontWeight: 800, marginBottom: 10 }}>{card.label}</div>
      <div style={{ color: C.text, fontSize: 24, lineHeight: 1.15, fontWeight: 900, wordBreak: "break-word" }}>
        {card.value}
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>{card.sub}</div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <article style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, minHeight: 118 }}>
      <div style={{ width: "55%", height: 12, borderRadius: 999, background: "#e8eef6", marginBottom: 18 }} />
      <div style={{ width: "42%", height: 26, borderRadius: 8, background: "#e8eef6", marginBottom: 14 }} />
      <div style={{ width: "70%", height: 12, borderRadius: 999, background: "#e8eef6" }} />
    </article>
  );
}

function ReportSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ width: "100%", height: 16, borderRadius: 999, background: "#e8eef6" }} />
      <div style={{ width: "94%", height: 16, borderRadius: 999, background: "#e8eef6" }} />
      <div style={{ width: "72%", height: 16, borderRadius: 999, background: "#e8eef6" }} />
      <div style={{ height: 16 }} />
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} style={{ width: `${86 - index * 7}%`, height: 14, borderRadius: 999, background: "#e8eef6" }} />
      ))}
      <div style={{ height: 16 }} />
      <div style={{ width: "88%", height: 16, borderRadius: 999, background: "#e8eef6" }} />
    </div>
  );
}

function ReportContent({ report }) {
  return (
    <div style={{ color: C.text, lineHeight: 1.65, fontSize: 14 }}>
      <p style={{ margin: "0 0 18px" }}>{report.summary}</p>
      <ul style={{ margin: "0 0 18px", paddingLeft: 20 }}>
        {(report.bullets || []).map((bullet, index) => (
          <li key={`${bullet}-${index}`} style={{ marginBottom: 8 }}>{bullet}</li>
        ))}
      </ul>
      <p style={{ margin: 0, fontWeight: 700 }}>{report.recommendation}</p>
    </div>
  );
}

function EmptyReport() {
  return (
    <div style={{
      minHeight: 245,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      color: C.muted,
      gap: 8,
    }}>
      <div style={{ fontWeight: 900, color: C.text, fontSize: 18 }}>No report generated yet</div>
      <div style={{ maxWidth: 430, lineHeight: 1.5, fontSize: 14 }}>
        Choose a date range and generate clinic insights from real appointment and queue data.
      </div>
    </div>
  );
}

function BreakdownPanel({ title, empty, rows, labelKey, valueKey, accent }) {
  const max = Math.max(...rows.map((row) => intValue(row[valueKey])), 0);
  const filteredRows = rows.filter((row) => intValue(row[valueKey]) > 0);

  return (
    <section style={{
      background: C.white,
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(15,23,42,.04)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "15px 16px", borderBottom: `1px solid ${C.line}` }}>
        <h3 style={{ margin: 0, fontSize: 15, color: C.text }}>{title}</h3>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredRows.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, padding: "8px 0" }}>{empty}</div>
        ) : (
          filteredRows.map((row) => {
            const value = intValue(row[valueKey]);
            const width = max ? Math.max(6, Math.round((value / max) * 100)) : 0;
            return (
              <div key={`${title}-${row[labelKey]}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: C.text, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row[labelKey]}
                  </span>
                  <span style={{ color: C.muted, fontWeight: 800 }}>{value}</span>
                </div>
                <div style={{ height: 8, background: "#edf2f8", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${width}%`, height: "100%", background: accent, borderRadius: 999 }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default AnalyticsReports;