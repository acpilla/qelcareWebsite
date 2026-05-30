// FILE: src/components/Layout/Topbar.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getUserRole, authFetch } from "../../utils/auth";

const MenuIcon = () => (
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
 <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
 </svg>
);
const ChevronIcon = () => (
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="6 9 12 15 18 9"/>
 </svg>
);
const ProfileIcon = () => (
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
 </svg>
);
const SettingsIcon = () => (
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0.33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
 </svg>
);
const LogoutIcon = () => (
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
 </svg>
);
const BellIcon = () => (
 <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
 <path d="M13.73 21a2 2 0 0 1-3.46 0" />
 </svg>
);
const RefreshIcon = () => (
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="23 4 23 10 17 10" />
 <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
 </svg>
);

function Avatar({ name, size = 36, fontSize = 13 }) {
 const initials = name
 ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
 : "U";
 return (
 <div style={{
 width: size, height: size, borderRadius: "50%",
 background: "linear-gradient(135deg, #25549a, #0f2744)",
 color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
 fontWeight: 800, fontSize, flexShrink: 0,
 }}>{initials}</div>
 );
}

const PAGE_TITLES = {
 "/admin/dashboard": { title: "Administrator Dashboard", sub: "Overview & quick actions" },
 "/admin/users": { title: "Manage Users", sub: "View and control all accounts" },
 "/admin/patients": { title: "Patient Management", sub: "Patient records and info" },
 "/admin/appointments": { title: "Appointment Management", sub: "Schedule and manage visits" },
 "/admin/queue": { title: "Queue Management", sub: "Monitor active queues" },
 "/admin/records": { title: "Medical Records", sub: "Patient documents and history" },
 "/admin/reports": { title: "Reports & Analytics", sub: "System analytics and reports" },
 "/admin/logs": { title: "Activity Logs", sub: "Recent administrative activity" },
 "/admin/profile": { title: "Profile Settings", sub: "Your account preferences" },
 "/nurse-station": { title: "Nurse Station", sub: "Patient vitals and queue" },
 "/doctor/dashboard": { title: "Doctor Dashboard", sub: "Queued patients and consultation records" },
 "/frontdesk/dashboard":{ title: "Frontdesk Dashboard", sub: "Confirm appointments and check-ins" },
 "/frontdesk/appointments": { title: "Frontdesk Appointments", sub: "Confirm, reschedule, and cancel visits" },
 "/dashboard": { title: "Patient Dashboard", sub: "Your health overview" },
};

const PROFILE_PATH = {
 Admin: "/admin/profile",
 Doctor: "/doctor/profile",
 Frontdesk: "/frontdesk/profile",
 Nurse: "/nurse/profile",
 Cashier: "/cashier/profile",
 Patient: "/patient/profile",
};

function toManilaDate(value = new Date()) {
 const parts = new Intl.DateTimeFormat("en-CA", {
 timeZone: "Asia/Manila",
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 }).formatToParts(value);
 const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
 return `${map.year}-${map.month}-${map.day}`;
}

function formatAppointmentTime(appointment) {
 const date = appointment?.date || appointment?.appointment_date;
 const time = appointment?.time || appointment?.appointment_time;
 if (!date && !time) return "Schedule not set";
 return [date, time].filter(Boolean).join(" ");
}

function getRows(payload) {
 if (!payload) return [];
 if (Array.isArray(payload.data)) return payload.data;
 if (Array.isArray(payload.data?.queue)) return payload.data.queue;
 if (Array.isArray(payload.data?.appointments)) return payload.data.appointments;
 if (Array.isArray(payload.data?.records)) return payload.data.records;
 if (Array.isArray(payload.appointments)) return payload.appointments;
 if (Array.isArray(payload.records)) return payload.records;
 if (Array.isArray(payload.queue)) return payload.queue;
 if (Array.isArray(payload.items)) return payload.items;
 return [];
}

function getStoredUser() {
 try {
 const stored = localStorage.getItem("user");
 return stored ? JSON.parse(stored) : null;
 } catch {
 return null;
 }
}

function getReadKey(role) {
 const storedUser = getStoredUser();
 const userId = storedUser?.user_id || localStorage.getItem("userId") || storedUser?.id || role || "user";
 return `qelcare_read_notifications_${userId}`;
}

function readSeenNotifications(role) {
 try {
 const raw = localStorage.getItem(getReadKey(role));
 const parsed = raw ? JSON.parse(raw) : [];
 return new Set(Array.isArray(parsed) ? parsed : []);
 } catch {
 return new Set();
 }
}

function writeSeenNotification(role, id) {
 if (!id || id === "clear" || id === "error") return;
 const key = getReadKey(role);
 const seen = readSeenNotifications(role);
 seen.add(id);
 const next = Array.from(seen).slice(-80);
 localStorage.setItem(key, JSON.stringify(next));
}

async function safeJson(response) {
 if (!response) return null;
 try {
 return await response.json();
 } catch {
 return null;
 }
}

function makeNotification(id, title, body, path, tone = "info") {
 return { id, title, body, path, tone };
}

function idsFor(rows) {
 return rows
 .map((item) => item.id || item.appointment_id || item.queue_id || item.record_id || item.result_id)
 .filter(Boolean)
 .sort((a, b) => String(a).localeCompare(String(b)))
 .join("-");
}

async function hasPaidBill(appointmentId) {
 if (!appointmentId) return false;
 try {
 const response = await authFetch(`/billing/appointment/${appointmentId}`);
 if (!response || response.status === 404) return false;
 const payload = await safeJson(response);
 if (!response.ok || !payload?.success) return false;
 const bill = payload.data || payload.billing;
 return bill?.status === "PAID";
 } catch {
 return false;
 }
}

function filterSeen(role, items) {
 const seen = readSeenNotifications(role);
 const visible = items.filter((item) => !seen.has(item.id));
 if (!visible.length) {
 return [makeNotification("clear", "No new notifications", "You are caught up for now.", null, "success")];
 }
 return visible;
}

function NotificationItem({ item, onOpen }) {
 const tone = {
 info: { color: "#163a6b", bg: "#eef3fb" },
 success: { color: "#1f7a52", bg: "#eaf7f0" },
 warning: { color: "#8a5a12", bg: "#fff6e5" },
 urgent: { color: "#a03a3a", bg: "#fff0f0" },
 }[item.tone] || { color: "#163a6b", bg: "#eef3fb" };

 return (
 <button
 type="button"
 onClick={() => onOpen(item)}
 style={{
 width: "100%",
 border: "none",
 background: "transparent",
 padding: "10px 12px",
 display: "grid",
 gridTemplateColumns: "10px 1fr",
 gap: 10,
 textAlign: "left",
 cursor: item.path ? "pointer" : "default",
 borderRadius: 10,
 }}
 onMouseEnter={(event) => { event.currentTarget.style.background = "#f6f9ff"; }}
 onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
 >
 <span style={{ width: 10, height: 10, borderRadius: "50%", background: tone.color, marginTop: 5 }} />
 <span>
 <span style={{ display: "block", color: "#0f2744", fontSize: 13, fontWeight: 800 }}>{item.title}</span>
 <span style={{ display: "block", color: "#66778a", fontSize: 12, lineHeight: 1.4, marginTop: 3 }}>{item.body}</span>
 <span style={{ display: "inline-flex", marginTop: 7, padding: "3px 7px", borderRadius: 999, color: tone.color, background: tone.bg, fontSize: 10.5, fontWeight: 900 }}>
 {item.tone === "urgent" ? "Action needed" : item.tone === "warning" ? "Pending" : item.tone === "success" ? "Updated" : "Notice"}
 </span>
 </span>
 </button>
 );
}

export default function Topbar({ sideOpen, onToggle, pageTitle, pageSubtitle }) {
 const navigate = useNavigate();
 const [dropOpen, setDropOpen] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
 const [notifications, setNotifications] = useState([]);
 const [notifLoading, setNotifLoading] = useState(false);
 const [notifError, setNotifError] = useState("");
 const [user, setUser] = useState(null);
 const dropRef = useRef(null);
 const notifRef = useRef(null);
 const role = getUserRole() || "Admin";

 const today = new Date().toLocaleDateString("en-PH", {
 weekday: "long", year: "numeric", month: "long", day: "numeric",
 });

 const loadNotifications = useCallback(async () => {
 setNotifLoading(true);
 setNotifError("");
 try {
 const today = toManilaDate();
 const next = [];

 if (role === "Patient") {
 const [appointmentsResponse, recordsResponse] = await Promise.all([
 authFetch("/appointments/me?limit=8"),
 authFetch("/medical-records/me"),
 ]);
 const appointmentPayload = await safeJson(appointmentsResponse);
 const recordPayload = await safeJson(recordsResponse);
 const appointments = getRows(appointmentPayload);
 const records = getRows(recordPayload);
 const pending = appointments.filter((item) => item.status === "PENDING");
 const confirmed = appointments.filter((item) => item.status === "CONFIRMED");
 const inQueue = appointments.filter((item) => item.status === "IN_QUEUE");
 const completed = appointments.filter((item) => item.status === "COMPLETED");

 if (inQueue.length) {
 next.push(makeNotification(`patient-in-queue-${idsFor(inQueue)}`, "You are in queue", `${inQueue.length} appointment${inQueue.length === 1 ? "" : "s"} waiting for clinic service.`, "/patient/appointments", "urgent"));
 }
 if (confirmed.length) {
 next.push(makeNotification(`patient-confirmed-${idsFor(confirmed)}`, "Appointment confirmed", `${confirmed.length} confirmed appointment${confirmed.length === 1 ? "" : "s"} ready for visit.`, "/patient/appointments", "success"));
 }
 if (pending.length) {
 next.push(makeNotification(`patient-pending-${idsFor(pending)}`, "Appointment pending", `${pending.length} booking request${pending.length === 1 ? "" : "s"} waiting for clinic approval.`, "/patient/appointments", "warning"));
 }
 if (completed.length || records.length) {
 const fingerprint = idsFor(records.length ? records : completed) || "latest";
 next.push(makeNotification(`patient-records-${fingerprint}`, "Consultation records available", "Check completed visits, prescriptions, and doctor notes.", "/patient/records", "info"));
 }
 } else if (role === "Frontdesk" || role === "Admin") {
 const [pendingResponse, todayResponse] = await Promise.all([
 authFetch("/appointments?status=PENDING&limit=8"),
 authFetch(`/appointments?date=${today}&limit=8`),
 ]);
 const pendingPayload = await safeJson(pendingResponse);
 const todayPayload = await safeJson(todayResponse);
 const pendingRows = getRows(pendingPayload);
 const todayRows = getRows(todayPayload);
 const noShows = todayRows.filter((item) => item.status === "CONFIRMED" || item.status === "IN_QUEUE");

 if (pendingRows.length) {
 next.push(makeNotification(`frontdesk-pending-${idsFor(pendingRows)}`, "Appointments need approval", `${pendingRows.length} patient booking${pendingRows.length === 1 ? "" : "s"} waiting for confirmation.`, role === "Admin" ? "/admin/appointments" : "/frontdesk/appointments", "urgent"));
 }
 if (noShows.length) {
 next.push(makeNotification(`frontdesk-today-${idsFor(noShows)}`, "Today's appointments active", `${noShows.length} confirmed or queued appointment${noShows.length === 1 ? "" : "s"} to monitor.`, role === "Admin" ? "/admin/appointments" : "/frontdesk/appointments", "info"));
 }
 } else if (role === "Nurse") {
 const response = await authFetch("/queue/display");
 const payload = await safeJson(response);
 const queues = getRows(payload);
 const waiting = queues.filter((item) => ["WAITING", "CALLED"].includes(item.status));
 if (waiting.length) {
 next.push(makeNotification(`nurse-queue-${idsFor(waiting)}`, "Patients waiting for vitals", `${waiting.length} patient${waiting.length === 1 ? "" : "s"} ready in the live queue.`, "/nurse-station", "urgent"));
 }
 } else if (role === "Doctor") {
 const response = await authFetch("/appointments?status=IN_QUEUE&limit=8");
 const payload = await safeJson(response);
 const rows = getRows(payload);
 if (rows.length) {
 next.push(makeNotification(`doctor-queue-${idsFor(rows)}`, "Patients ready for consultation", `${rows.length} queued patient${rows.length === 1 ? "" : "s"} assigned to you.`, "/doctor/dashboard", "urgent"));
 }
 } else if (role === "Cashier") {
 const response = await authFetch(`/appointments?date=${today}&status=COMPLETED&limit=8`);
 const payload = await safeJson(response);
 const rows = getRows(payload);
 const unpaidRows = [];
 for (const row of rows) {
 const paid = await hasPaidBill(row.id || row.appointment_id);
 if (!paid) unpaidRows.push(row);
 }
 if (unpaidRows.length) {
 next.push(makeNotification(`cashier-completed-${idsFor(unpaidRows)}`, "Post-consult payments", `${unpaidRows.length} completed visit${unpaidRows.length === 1 ? "" : "s"} need billing.`, "/cashier/dashboard", "warning"));
 }
 }

 if (!next.length) {
 next.push(makeNotification("clear", "No urgent notifications", "You are caught up for now.", null, "success"));
 }

 setNotifications(filterSeen(role, next));
 } catch (err) {
 setNotifError(err.message || "Notifications unavailable.");
 setNotifications([makeNotification("error", "Notifications unavailable", "Refresh or continue using the module normally.", null, "warning")]);
 } finally {
 setNotifLoading(false);
 }
 }, [role]);

 useEffect(() => {
 const stored = localStorage.getItem("user");
 if (stored) setUser(JSON.parse(stored));
 const handleClick = e => {
 if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
 if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
 };
 document.addEventListener("mousedown", handleClick);
 return () => document.removeEventListener("mousedown", handleClick);
 }, []);

 useEffect(() => {
 loadNotifications();
 const timer = setInterval(loadNotifications, 60000);
 return () => clearInterval(timer);
 }, [loadNotifications]);

 const fullName = user ? `${user.first_name} ${user.last_name}` : role;
 const location = window.location.pathname;
 const page = PAGE_TITLES[location] || { title: pageTitle || "Dashboard", sub: pageSubtitle || today };
 const activeNotifications = notifications.filter((item) => item.id !== "clear" && item.id !== "error").length;
 const urgentCount = notifications.filter((item) => item.tone === "urgent").length;

 const topNotification = useMemo(() => {
 const action = notifications.find((item) => item.tone === "urgent") || notifications.find((item) => item.tone === "warning");
 if (!action || action.id === "clear" || action.id === "error") return null;
 return action;
 }, [notifications]);

 function openNotification(item) {
 writeSeenNotification(role, item.id);
 setNotifications((current) => {
 const remaining = current.filter((entry) => entry.id !== item.id);
 return remaining.length ? remaining : [makeNotification("clear", "No new notifications", "You are caught up for now.", null, "success")];
 });
 if (item.path) {
 setNotifOpen(false);
 navigate(item.path);
 }
 }

 return (
 <header style={{
 height: 64,
 background: "#fff",
 borderBottom: "1px solid #e8eef6",
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 padding: "0 24px",
 gap: 16,
 position: "sticky",
 top: 0,
 zIndex: 30,
 boxShadow: "0 1px 8px rgba(15,23,42,.05)",
 flexShrink: 0,
 }}>

 {/* Left */}
 <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
 <button
 onClick={onToggle}
 style={{
 width: 36, height: 36, borderRadius: 9,
 border: "1px solid #e8eef6",
 background: "#f8fafd",
 cursor: "pointer",
 display: "grid", placeItems: "center",
 color: "#163a6b", flexShrink: 0,
 transition: ".15s",
 }}
 onMouseEnter={e => { e.currentTarget.style.background = "#eef3fb"; }}
 onMouseLeave={e => { e.currentTarget.style.background = "#f8fafd"; }}
 >
 <MenuIcon />
 </button>

 <div>
 <div style={{ fontSize: 16, fontWeight: 800, color: "#0f2744", letterSpacing: "-.02em", lineHeight: 1.2 }}>
 {page.title}
 </div>
 <div style={{ fontSize: 11.5, color: "#8a97a8", marginTop: 1 }}>{page.sub || today}</div>
 </div>
 </div>

 {/* Right */}
 <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
 {topNotification && (
 <button
 type="button"
 onClick={() => openNotification(topNotification)}
 style={{
 border: "1px solid #f1d6a5",
 background: "#fff8e8",
 color: "#8a5a12",
 borderRadius: 999,
 height: 32,
 padding: "0 11px",
 maxWidth: 260,
 display: "flex",
 alignItems: "center",
 gap: 7,
 cursor: "pointer",
 fontSize: 12,
 fontWeight: 800,
 whiteSpace: "nowrap",
 overflow: "hidden",
 textOverflow: "ellipsis",
 }}
 title={topNotification.body}
 >
 <span style={{ width: 7, height: 7, borderRadius: "50%", background: urgentCount ? "#a03a3a" : "#8a5a12", flexShrink: 0 }} />
 <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{topNotification.title}</span>
 </button>
 )}

 <div style={{ position: "relative" }} ref={notifRef}>
 <button
 type="button"
 onClick={() => setNotifOpen((value) => !value)}
 title="Notifications"
 style={{
 width: 36,
 height: 36,
 borderRadius: 999,
 border: "1px solid #e8eef6",
 background: notifOpen ? "#eef3fb" : "#fff",
 color: "#163a6b",
 display: "grid",
 placeItems: "center",
 cursor: "pointer",
 position: "relative",
 }}
 >
 <BellIcon />
 {activeNotifications > 0 && (
 <span style={{
 position: "absolute",
 top: -4,
 right: -4,
 minWidth: 17,
 height: 17,
 borderRadius: 999,
 background: urgentCount ? "#c94b5a" : "#163a6b",
 color: "#fff",
 fontSize: 10,
 fontWeight: 900,
 display: "grid",
 placeItems: "center",
 border: "2px solid #fff",
 padding: "0 4px",
 }}>
 {activeNotifications > 9 ? "9+" : activeNotifications}
 </span>
 )}
 </button>

 {notifOpen && (
 <div style={{
 position: "absolute",
 top: "calc(100% + 8px)",
 right: 0,
 width: 340,
 maxWidth: "calc(100vw - 30px)",
 background: "#fff",
 borderRadius: 14,
 border: "1px solid #e8eef6",
 boxShadow: "0 16px 40px rgba(15,23,42,.12)",
 padding: 8,
 zIndex: 120,
 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 10px", borderBottom: "1px solid #f0f4f9", marginBottom: 4 }}>
 <div>
 <div style={{ color: "#0f2744", fontWeight: 900, fontSize: 14 }}>Notifications</div>
 <div style={{ color: "#8a97a8", fontSize: 11, marginTop: 2 }}>{role} workflow updates</div>
 </div>
 <button
 type="button"
 onClick={loadNotifications}
 disabled={notifLoading}
 title="Refresh notifications"
 style={{
 width: 31,
 height: 31,
 borderRadius: 9,
 border: "1px solid #e8eef6",
 background: "#fff",
 color: "#163a6b",
 display: "grid",
 placeItems: "center",
 cursor: notifLoading ? "not-allowed" : "pointer",
 opacity: notifLoading ? 0.6 : 1,
 }}
 >
 <RefreshIcon />
 </button>
 </div>
 {notifError && (
 <div style={{ margin: "8px 10px", padding: "8px 10px", borderRadius: 8, background: "#fff6e5", color: "#8a5a12", fontSize: 12, fontWeight: 700 }}>
 {notifError}
 </div>
 )}
 <div style={{ maxHeight: 340, overflowY: "auto" }}>
 {notifLoading && notifications.length === 0 ? (
 <div style={{ padding: 16, color: "#66778a", fontSize: 13 }}>Loading notifications...</div>
 ) : (
 notifications.map((item) => (
 <NotificationItem key={item.id} item={item} onOpen={openNotification} />
 ))
 )}
 </div>
 </div>
 )}
 </div>

 <div style={{ display: "flex", alignItems: "center", gap: 10 }} ref={dropRef}>
 {/* Role badge */}
 <div style={{
 padding: "5px 12px", borderRadius: 99,
 background: "#eef3fb", border: "1px solid #d8e5f8",
 fontSize: 11.5, fontWeight: 700, color: "#163a6b",
 }}>
 {role}
 </div>

 {/* Profile button */}
 <button
 onClick={() => setDropOpen(v => !v)}
 style={{
 display: "flex", alignItems: "center", gap: 9,
 padding: "5px 10px 5px 5px",
 borderRadius: 99, border: "1px solid #e8eef6",
 background: dropOpen ? "#f2f6fc" : "#fff",
 cursor: "pointer", transition: ".15s",
 }}
 onMouseEnter={e => { e.currentTarget.style.background = "#f2f6fc"; }}
 onMouseLeave={e => { if (!dropOpen) e.currentTarget.style.background = "#fff"; }}
 >
 <Avatar name={fullName} size={32} fontSize={12} />
 <div style={{ textAlign: "left" }}>
 <div style={{ fontSize: 13, fontWeight: 700, color: "#0f2744", lineHeight: 1.2 }}>{fullName}</div>
 <div style={{ fontSize: 11, color: "#8a97a8" }}>{user?.email || ""}</div>
 </div>
 <span style={{ color: "#8a97a8", marginLeft: 2, display: "flex", transform: dropOpen ? "rotate(180deg)" : "none", transition: ".2s" }}>
 <ChevronIcon />
 </span>
 </button>

 {/* Dropdown */}
 {dropOpen && (
 <div style={{
 position: "absolute", top: "calc(100% + 8px)", right: 24,
 width: 230, background: "#fff", borderRadius: 14,
 border: "1px solid #e8eef6",
 boxShadow: "0 16px 40px rgba(15,23,42,.12)",
 padding: 8, zIndex: 100,
 }}>
 {/* User info */}
 <div style={{
 display: "flex", alignItems: "center", gap: 10,
 padding: "10px 10px 12px", borderBottom: "1px solid #f0f4f9", marginBottom: 6,
 }}>
 <Avatar name={fullName} size={38} />
 <div>
 <div style={{ fontSize: 13, fontWeight: 700, color: "#0f2744" }}>{fullName}</div>
 <div style={{ fontSize: 11, color: "#8a97a8" }}>{user?.email || ""}</div>
 </div>
 </div>

 {/* Menu items */}
 {[
 { icon: <ProfileIcon />, label: "My Profile", action: () => { navigate(PROFILE_PATH[role] || "/"); setDropOpen(false); } },
 { icon: <SettingsIcon />, label: "Account Settings", action: () => { navigate(PROFILE_PATH[role] || "/"); setDropOpen(false); } },
 ].map(item => (
 <button key={item.label} onClick={item.action} style={{
 width: "100%", display: "flex", alignItems: "center", gap: 10,
 padding: "10px 12px", borderRadius: 9, border: "none",
 background: "transparent", cursor: "pointer",
 fontSize: 13, fontWeight: 600, color: "#182433", textAlign: "left",
 transition: ".13s",
 }}
 onMouseEnter={e => { e.currentTarget.style.background = "#f6f9ff"; }}
 onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
 >
 <span style={{ color: "#5a7a9e", display: "flex" }}>{item.icon}</span>
 {item.label}
 </button>
 ))}

 <div style={{ height: 1, background: "#f0f4f9", margin: "6px 0" }} />

 <button onClick={logout} style={{
 width: "100%", display: "flex", alignItems: "center", gap: 10,
 padding: "10px 12px", borderRadius: 9, border: "none",
 background: "transparent", cursor: "pointer",
 fontSize: 13, fontWeight: 600, color: "#c94b5a", textAlign: "left",
 transition: ".13s",
 }}
 onMouseEnter={e => { e.currentTarget.style.background = "#fff5f5"; }}
 onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
 >
 <span style={{ display: "flex" }}><LogoutIcon /></span>
 Logout
 </button>
 </div>
 )}
 </div>
 </div>
 </header>
 );
}
