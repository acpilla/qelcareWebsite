import React, { useState, useMemo } from "react";

const CSS = `
  .cd-root {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: linear-gradient(180deg, #faf3f5 0%, #f6edef 100%);
    color: #2f1c21;
    min-height: 100vh;
    margin: 0;
    padding: 0;
  }
  .cd-root *, .cd-root *::before, .cd-root *::after { box-sizing: border-box; }

  /* TOPBAR */
  .cd-topbar {
    height: 76px;
    background: linear-gradient(90deg, #8f1f2f 0%, #b52c42 100%);
    color: #fff;
    display: grid;
    grid-template-columns: 220px 1fr 260px;
    align-items: center;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 20;
    box-shadow: 0 8px 25px rgba(69,14,24,0.18);
    gap: 16px;
  }
  .cd-title {
    justify-self: center;
    text-align: center;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -.03em;
    margin: 0;
  }
  .cd-profile-menu {
    position: relative;
    justify-self: end;
  }
  .cd-profile-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px 8px 18px;
    border-radius: 999px;
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.12);
    min-width: 250px;
    justify-content: space-between;
    cursor: pointer;
    color: #fff;
  }
  .cd-profile-trigger:hover { background: rgba(255,255,255,.14); }
  .cd-profile-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .cd-profile-meta { display: flex; flex-direction: column; min-width: 0; }
  .cd-profile-meta .cd-meta {
    font-size: .95rem; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cd-profile-meta .cd-sub-meta {
    font-size: .76rem; color: rgba(255,255,255,.8);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cd-profile-caret {
    font-size: .9rem;
    transition: transform .2s ease;
    display: inline-block;
  }
  .cd-profile-caret.open { transform: rotate(180deg); }
  .cd-avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #e57b8a, #7a1827);
    color: #fff; font-weight: 800;
    border: 2px solid rgba(255,255,255,.7);
    box-shadow: 0 4px 10px rgba(0,0,0,.18);
    flex-shrink: 0;
    font-size: .9rem;
  }
  .cd-profile-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 220px;
    background: #fff;
    border: 1px solid #ead9de;
    border-radius: 16px;
    box-shadow: 0 16px 36px rgba(60,10,20,0.18);
    padding: 8px;
    overflow: hidden;
    z-index: 100;
  }
  .cd-dropdown-header {
    padding: 10px 12px 12px;
    border-bottom: 1px solid #f1e2e6;
    margin-bottom: 6px;
  }
  .cd-dropdown-header strong { display: block; color: #2f1c21; font-size: .92rem; margin-bottom: 2px; }
  .cd-dropdown-header span { color: #8d6c75; font-size: .78rem; }
  .cd-dropdown-item {
    width: 100%; border: none; background: transparent;
    text-align: left; padding: 12px 12px; border-radius: 12px;
    color: #2f1c21; font-weight: 700; cursor: pointer;
    transition: background .18s ease, color .18s ease;
    font-family: inherit; font-size: .9rem; display: block;
  }
  .cd-dropdown-item:hover { background: #f9eef1; color: #8f1f2f; }
  .cd-dropdown-item.cd-logout { color: #b52c42; }

  /* LAYOUT */
  .cd-layout {
    max-width: 1440px;
    margin: 12px auto;
    padding: 0 14px 18px;
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 14px;
    height: calc(100vh - 96px);
    align-items: stretch;
    overflow: hidden;
  }
  .cd-panel {
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 14px 35px rgba(82,18,29,0.12);
    border: 1px solid rgba(143,31,47,.06);
  }

  /* LEFT PANEL */
  .cd-left-panel {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .cd-hero {
    background: linear-gradient(135deg, #8f1f2f 0%, #b52c42 72%, #cf4a61 100%);
    border-radius: 18px;
    padding: 16px;
    color: #fff;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }
  .cd-hero::after {
    content: "";
    position: absolute;
    right: -50px; top: -30px;
    width: 220px; height: 220px;
    background: radial-gradient(circle, rgba(255,255,255,.11) 0%, rgba(255,255,255,.03) 55%, transparent 70%);
    border-radius: 50%;
  }
  .cd-hero h1 {
    margin: 0 0 6px;
    font-size: 1.34rem; line-height: 1.12;
    letter-spacing: -.03em; max-width: 260px;
  }
  .cd-hero p {
    margin: 0;
    color: rgba(255,255,255,.84);
    line-height: 1.45; max-width: 310px; font-size: .9rem;
  }
  .cd-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    flex-shrink: 0;
  }
  .cd-stat-card {
    border-radius: 15px; padding: 12px;
    background: linear-gradient(180deg, #fff9fa 0%, #f8eff2 100%);
    border: 1px solid #ead9de;
  }
  .cd-stat-card .cd-label { color: #8d6c75; font-size: .86rem; font-weight: 600; }
  .cd-stat-card .cd-value { margin-top: 6px; font-size: 1.45rem; font-weight: 800; color: #8f1f2f; }
  .cd-stat-card .cd-sub { margin-top: 4px; color: #8d6c75; font-size: .92rem; }
  .cd-section-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 2px; padding: 0 2px; flex-shrink: 0;
  }
  .cd-section-head h2 { margin: 0; font-size: 1rem; }
  .cd-section-head span { color: #8d6c75; font-size: .82rem; }
  .cd-search-box {
    display: flex; align-items: center; gap: 8px;
    background: #fbf5f7; border: 1px solid #ead9de;
    border-radius: 12px; padding: 10px 12px; flex-shrink: 0;
  }
  .cd-search-box input {
    border: none; outline: none; background: transparent;
    width: 100%; color: #2f1c21; font-family: inherit; font-size: .9rem;
  }
  .cd-schedule-list {
    display: flex; flex-direction: column; gap: 12px;
    overflow-y: auto; overflow-x: hidden;
    padding-right: 6px; flex: 1; min-height: 0;
    scrollbar-gutter: stable;
  }
  .cd-schedule-list::-webkit-scrollbar { width: 10px; }
  .cd-schedule-list::-webkit-scrollbar-thumb { background: #d7bcc3; border-radius: 999px; border: 2px solid #eef5f6; }
  .cd-schedule-list::-webkit-scrollbar-track { background: #f7eff1; border-radius: 999px; }

  /* VISIT CARD */
  .cd-visit-card {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    gap: 10px; padding: 11px;
    background: #fff; border: 1px solid #ead9de;
    border-radius: 15px; cursor: pointer;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    align-items: start;
  }
  .cd-visit-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(90,23,35,.09); border-color: #ddbfc7; }
  .cd-visit-card.cd-active {
    border: 2px solid #b52c42;
    background: linear-gradient(180deg, #ffffff 0%, #fdf5f7 100%);
    box-shadow: 0 14px 28px rgba(90,23,35,.12);
  }
  .cd-date-badge {
    border-radius: 13px;
    background: linear-gradient(180deg, #fff1f4 0%, #f9e1e7 100%);
    color: #8f1f2f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 56px; border: 1px solid #efcfd7;
  }
  .cd-date-badge strong { font-size: 1.2rem; line-height: 1; }
  .cd-date-badge span { font-size: .68rem; font-weight: 700; letter-spacing: .08em; }
  .cd-visit-main h3 { margin: 0 0 3px; font-size: .96rem; line-height: 1.2; }
  .cd-patient-line {
    display: flex; flex-wrap: wrap; gap: 6px;
    align-items: center; margin-bottom: 4px;
    color: #8d6c75; font-size: .79rem;
  }
  .cd-meta-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 10px; color: #8d6c75; font-size: .78rem;
    line-height: 1.28; min-width: 0;
  }
  .cd-meta-grid > div { min-width: 0; word-break: break-word; }
  .cd-pill {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px; border-radius: 999px; padding: 6px 10px;
    font-size: .72rem; font-weight: 700; white-space: nowrap;
    height: fit-content; min-width: 74px; text-align: center;
    justify-self: end; align-self: start;
  }
  .cd-pill.cd-waiting { background: #fff3dc; color: #9b6200; }
  .cd-pill.cd-ready { background: #e6f7ef; color: #146c43; }
  .cd-pill.cd-followup { background: #ecf3ff; color: #3b68a3; }

  /* RIGHT PANEL */
  .cd-right-panel {
    padding: 14px; display: flex; flex-direction: column;
    gap: 12px; min-height: 0; height: 100%; overflow: hidden;
  }
  .cd-content-grid {
    display: grid; grid-template-columns: 1fr .86fr;
    gap: 12px; align-items: stretch;
    min-width: 0; flex: 1; min-height: 0;
  }
  .cd-card {
    background: #fff; border: 1px solid #ead9de;
    border-radius: 18px; box-shadow: 0 10px 22px rgba(82,18,29,0.05);
    padding: 14px; min-width: 0;
  }
  .cd-card h3 { margin: 0 0 10px; font-size: 1rem; }
  .cd-history-card {
    display: flex; flex-direction: column;
    height: 100%; min-height: 0;
  }
  .cd-history-scroll {
    flex: 1; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    padding-right: 8px;
  }
  .cd-history-scroll::-webkit-scrollbar { width: 10px; }
  .cd-history-scroll::-webkit-scrollbar-thumb { background: #d7bcc3; border-radius: 999px; border: 2px solid #eef5f6; }
  .cd-history-scroll::-webkit-scrollbar-track { background: #f7eff1; border-radius: 999px; }
  .cd-timeline { display: flex; flex-direction: column; gap: 10px; }
  .cd-timeline-item {
    display: grid; grid-template-columns: 88px 1fr;
    gap: 10px; padding-bottom: 10px;
    border-bottom: 1px solid #f2e4e8;
  }
  .cd-timeline-item:last-child { border-bottom: none; padding-bottom: 0; }
  .cd-timeline-date { font-weight: 800; color: #8f1f2f; font-size: .8rem; }
  .cd-timeline-body strong { display: block; margin-bottom: 2px; font-size: .88rem; line-height: 1.25; }
  .cd-timeline-body p { margin: 0; color: #8d6c75; line-height: 1.4; font-size: .82rem; }

  /* ACTIONS CARD */
  .cd-actions-card {
    display: flex; flex-direction: column;
    height: 100%; min-height: 0;
  }
  .cd-info-list { display: grid; gap: 0; }
  .cd-info-row {
    display: grid; grid-template-columns: 132px 1fr;
    gap: 10px; padding: 9px 0;
    border-bottom: 1px solid #f2e4e8;
    font-size: .84rem; line-height: 1.35;
  }
  .cd-info-row:last-child { border-bottom: none; }
  .cd-info-row .cd-label { color: #8d6c75; font-weight: 700; }
  .cd-info-row .cd-value { font-weight: 600; }
  .cd-action-row {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px;
  }
  .cd-btn {
    border: none; border-radius: 12px; padding: 10px 14px;
    font-weight: 800; cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease;
    font-family: inherit; font-size: .9rem;
  }
  .cd-btn:hover { transform: translateY(-1px); }
  .cd-btn-primary { background: #8f1f2f; color: #fff; box-shadow: 0 10px 20px rgba(20,92,99,.18); }
  .cd-btn-secondary { background: #f8ecef; color: #8f1f2f; }
  .cd-btn-success { background: #2d9c6b; color: #fff; box-shadow: 0 10px 20px rgba(46,156,100,.18); }
  .cd-footer-note {
    margin-top: 8px; color: #8d6c75; font-size: .76rem; line-height: 1.35;
  }
  .cd-checked-banner {
    margin-top: 10px; padding: 11px 12px;
    border-radius: 13px;
    background: #e8f7ee; color: #176943;
    border: 1px solid #b7e3c9; font-weight: 700;
    font-size: .88rem;
  }

  @media (max-width: 1220px) {
    .cd-layout { grid-template-columns: 1fr; height: auto; overflow: visible; }
    .cd-left-panel, .cd-right-panel { height: auto; overflow: visible; }
    .cd-content-grid { grid-template-columns: 1fr; }
    .cd-schedule-list { max-height: 480px; }
  }
  @media (max-width: 780px) {
    .cd-topbar { grid-template-columns: 1fr; gap: 10px; height: auto; padding: 14px; }
    .cd-title { text-align: center; }
    .cd-profile-menu { justify-self: stretch; }
    .cd-profile-trigger { width: 100%; min-width: 0; }
    .cd-profile-dropdown { width: 100%; }
    .cd-layout { padding: 0 12px 22px; }
    .cd-summary-grid { grid-template-columns: 1fr; }
    .cd-visit-card { grid-template-columns: 58px minmax(0, 1fr); }
    .cd-visit-card .cd-pill { grid-column: 2; justify-self: start; }
    .cd-timeline-item, .cd-info-row { grid-template-columns: 1fr; }
  }
`;

const patients = [
  { id: 1, day: "12", mon: "JUN", status: "waiting", name: "Miguel Navarro", age: "58 years", sex: "Male", type: "Heart Failure Follow-up", doctor: "Dr. Andrea Velasco", time: "08:30 AM", room: "Cardio Room 2", concern: "Heart failure follow-up with dyspnea and edema review", history: [["Jun 08, 2026", "Cardiology review", "Persistent exertional dyspnea but improved edema after diuretic compliance."], ["May 29, 2026", "Heart failure follow-up", "Adjusted loop diuretic and advised sodium restriction."], ["Apr 11, 2026", "Initial cardiology consult", "Presented with dyspnea on exertion and bilateral leg swelling."], ["Feb 19, 2026", "Primary care referral", "Referred for ongoing heart failure symptoms and reduced exercise tolerance."]] },
  { id: 2, day: "12", mon: "JUN", status: "ready", name: "Sophia Ramirez", age: "61 years", sex: "Female", type: "Hypertension Follow-up", doctor: "Dr. Andrea Velasco", time: "09:10 AM", room: "Cardio Room 1", concern: "Blood pressure review and antihypertensive medication follow-up", history: [["Nov 14, 2025", "Cardiology consult", "Discussed home blood pressure monitoring and lifestyle measures."], ["Jul 04, 2025", "Acute consult", "Presented with uncontrolled blood pressure and dizziness."], ["Jan 10, 2025", "Follow-up", "Improved blood pressure with medication adjustment."]] },
  { id: 3, day: "12", mon: "JUN", status: "followup", name: "Ethan Cruz", age: "49 years", sex: "Male", type: "Arrhythmia Review", doctor: "Dr. Andrea Velasco", time: "10:00 AM", room: "Cardio Room 3", concern: "Palpitations follow-up and ECG review", history: [["Mar 03, 2026", "Cardiology follow-up", "Symptoms improved with rate control medication."], ["Jan 16, 2026", "Acute visit", "Presented with palpitations and mild shortness of breath."], ["Oct 20, 2025", "Primary review", "History of intermittent irregular heartbeat documented."]] },
  { id: 4, day: "12", mon: "JUN", status: "waiting", name: "Chloe Mendoza", age: "57 years", sex: "Female", type: "Chest Pain Consultation", doctor: "Dr. Andrea Velasco", time: "10:45 AM", room: "Cardio Room 4", concern: "Chest discomfort assessment and ischemic symptom review", history: [["Apr 22, 2026", "Chest pain review", "Symptoms consistent with exertional pattern."], ["Feb 18, 2026", "Initial consult", "Intermittent chest discomfort without syncope."], ["Dec 02, 2025", "Primary care note", "Referred after recurrent episodes over several weeks."]] },
  { id: 5, day: "12", mon: "JUN", status: "ready", name: "Noah Villanueva", age: "66 years", sex: "Male", type: "Post-PCI Evaluation", doctor: "Dr. Andrea Velasco", time: "11:25 AM", room: "Cardio Bay 1", concern: "Post-stent follow-up and medication adherence review", history: [["Jun 10, 2026", "Intake note", "Presents for first cardiology follow-up after recent PCI."], ["Sep 14, 2025", "Emergency note", "Advised urgent cardiology review after acute coronary syndrome."]] },
  { id: 6, day: "12", mon: "JUN", status: "followup", name: "Mia Santos", age: "52 years", sex: "Female", type: "Lipid Management Follow-up", doctor: "Dr. Andrea Velasco", time: "01:20 PM", room: "Cardio Room 5", concern: "Cholesterol management and statin medication review", history: [["May 05, 2026", "Lipid review", "Started regular statin therapy."], ["Feb 09, 2026", "Cardiology consult", "Discussed dietary modification and long-term prevention strategies."], ["Dec 13, 2025", "Follow-up", "Partial improvement with lifestyle intervention alone."]] },
  { id: 7, day: "12", mon: "JUN", status: "ready", name: "Gabriel Flores", age: "73 years", sex: "Male", type: "Valve Disease Assessment", doctor: "Dr. Andrea Velasco", time: "02:10 PM", room: "Cardio Room 6", concern: "Murmur review, dyspnea, and valve disease reassessment", history: [["Mar 20, 2026", "Cardiology review", "Advised observation and repeat symptom tracking."], ["Jan 17, 2026", "Initial consult", "Murmur and exertional symptoms documented."], ["Nov 19, 2025", "Primary care referral", "Referred for possible valvular heart disease."]] },
  { id: 8, day: "12", mon: "JUN", status: "followup", name: "Isabella Reyes", age: "45 years", sex: "Female", type: "Cardiomyopathy Follow-up", doctor: "Dr. Andrea Velasco", time: "03:00 PM", room: "Cardio Room 7", concern: "Fatigue follow-up and cardiomyopathy symptom review", history: [["Apr 28, 2026", "Cardiology review", "Advised medication continuation and graded activity."], ["Feb 11, 2026", "Initial consult", "Persistent fatigue and reduced exercise tolerance for more than 6 weeks."], ["Aug 22, 2025", "General consult", "Intermittent palpitations previously managed conservatively."]] },
];

const pillClass = (status) =>
  status === "waiting" ? "cd-pill cd-waiting" : status === "ready" ? "cd-pill cd-ready" : "cd-pill cd-followup";

const pillLabel = (status) =>
  status === "waiting" ? "Waiting" : status === "ready" ? "Ready" : "Follow-up";

export default function CardiologyDashboard() {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter((p) =>
      !q || [p.name, p.concern, p.type, p.room].some((v) => v.toLowerCase().includes(q))
    );
  }, [search]);

  const activePatient = patients.find((p) => p.id === activeId);

  const handleSelectPatient = (id) => {
    setActiveId(id);
    setChecked(false);
  };

  return (
    <div className="cd-root" onClick={() => setDropdownOpen(false)}>
      <style>{CSS}</style>

      {/* TOPBAR */}
      <header className="cd-topbar">
        <div />
        <h1 className="cd-title">QELCare Cardiology Dashboard</h1>

        <div className="cd-profile-menu" onClick={(e) => e.stopPropagation()}>
          <button
            className="cd-profile-trigger"
            onClick={() => setDropdownOpen((o) => !o)}
          >
            <div className="cd-profile-left">
              <div className="cd-avatar">DR</div>
              <div className="cd-profile-meta">
                <div className="cd-meta">Today: 8 Cardiology Consults</div>
                <div className="cd-sub-meta">Doctor Profile</div>
              </div>
            </div>
            <span className={`cd-profile-caret${dropdownOpen ? " open" : ""}`}>▾</span>
          </button>

          {dropdownOpen && (
            <div className="cd-profile-dropdown">
              <div className="cd-dropdown-header">
                <strong>Doctor Account</strong>
                <span>Cardiology Dashboard</span>
              </div>
              <button
                className="cd-dropdown-item cd-logout"
                onClick={() => { alert("Logging out..."); setDropdownOpen(false); }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* LAYOUT */}
      <main className="cd-layout">

        {/* LEFT PANEL */}
        <aside className="cd-panel cd-left-panel">
          <section className="cd-hero">
            <h1>Cardiology schedules and clinical charting in one view.</h1>
            <p>Review symptoms, examine treatment history, write prescriptions, and manage consultations with speed and clarity.</p>
          </section>

          <section className="cd-summary-grid">
            <div className="cd-stat-card">
              <div className="cd-label">Today's Queue</div>
              <div className="cd-value">08</div>
              <div className="cd-sub">2 waiting • 3 follow-ups</div>
            </div>
            <div className="cd-stat-card">
              <div className="cd-label">Active RX Drafts</div>
              <div className="cd-value">06</div>
              <div className="cd-sub">2 need final review</div>
            </div>
          </section>

          <div className="cd-section-head">
            <h2>Cardiology Patient Schedule</h2>
            <span>Click a patient to review</span>
          </div>

          <div className="cd-search-box">
            <span>🔎</span>
            <input
              type="text"
              placeholder="Search patient name, concern, or procedure..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <section className="cd-schedule-list">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`cd-visit-card${p.id === activeId ? " cd-active" : ""}`}
                onClick={() => handleSelectPatient(p.id)}
              >
                <div className="cd-date-badge">
                  <strong>{p.day}</strong>
                  <span>{p.mon}</span>
                </div>
                <div className="cd-visit-main">
                  <h3>{p.name}</h3>
                  <div className="cd-patient-line">{p.age} • {p.sex} • {p.time}</div>
                  <div className="cd-meta-grid">
                    <div><strong>Visit:</strong> {p.type}</div>
                    <div><strong>Room:</strong> {p.room}</div>
                    <div><strong>Doctor:</strong> {p.doctor}</div>
                    <div><strong>Concern:</strong> {p.concern}</div>
                  </div>
                </div>
                <span className={pillClass(p.status)}>{pillLabel(p.status)}</span>
              </div>
            ))}
          </section>
        </aside>

        {/* RIGHT PANEL */}
        <section className="cd-panel cd-right-panel">
          <div className="cd-content-grid">

            {/* History */}
            <div style={{ display: "grid", gap: 16 }}>
              <article className="cd-card cd-history-card">
                <h3>Cardiology Medical History & Previous Visits</h3>
                <div className="cd-history-scroll">
                  <div className="cd-timeline">
                    {activePatient?.history.map(([date, title, desc], i) => (
                      <div key={i} className="cd-timeline-item">
                        <div className="cd-timeline-date">{date}</div>
                        <div className="cd-timeline-body">
                          <strong>{title}</strong>
                          <p>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            </div>

            {/* Actions */}
            <div style={{ display: "grid", gap: 16 }}>
              <article className="cd-card cd-actions-card">
                <h3>Consultation Actions</h3>
                <div className="cd-info-list">
                  <div className="cd-info-row">
                    <div className="cd-label">Visit concern</div>
                    <div className="cd-value">{activePatient?.concern}</div>
                  </div>
                  <div className="cd-info-row">
                    <div className="cd-label">Assigned Cardiologist</div>
                    <div className="cd-value">Dr. Andrea Velasco, MD</div>
                  </div>
                  <div className="cd-info-row">
                    <div className="cd-label">Room</div>
                    <div className="cd-value">{activePatient?.room}</div>
                  </div>
                  <div className="cd-info-row">
                    <div className="cd-label">Next action</div>
                    <div className="cd-value">Review history, assess current cardiac status, and finalize management plan</div>
                  </div>
                </div>

                <div className="cd-action-row">
                  <button className="cd-btn cd-btn-success" onClick={() => setChecked(true)}>
                    Mark as Checked
                  </button>
                  <button className="cd-btn cd-btn-secondary">Schedule Follow-up</button>
                </div>

                {checked && (
                  <div className="cd-checked-banner">
                    This patient has been marked as checked by the cardiology doctor for today's visit.
                  </div>
                )}

                <div className="cd-footer-note">
                  Designed for cardiology workflows: hypertension follow-up, heart failure review, arrhythmia monitoring, chest pain assessment, lipid management, and post-procedure monitoring.
                </div>
              </article>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}