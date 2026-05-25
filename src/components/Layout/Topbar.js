// FILE: src/components/Layout/Topbar.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getUserRole } from "../../utils/auth";

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
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
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
  "/admin/dashboard":    { title: "Administrator Dashboard",  sub: "Overview & quick actions" },
  "/admin/users":        { title: "Manage Users",             sub: "View and control all accounts" },
  "/admin/patients":     { title: "Patient Management",       sub: "Patient records and info" },
  "/admin/appointments": { title: "Appointment Management",   sub: "Schedule and manage visits" },
  "/admin/queue":        { title: "Queue Management",         sub: "Monitor active queues" },
  "/admin/records":      { title: "Medical Records",          sub: "Patient documents and history" },
  "/admin/reports":      { title: "Reports & Analytics",      sub: "System analytics and reports" },
  "/admin/logs":         { title: "Activity Logs",            sub: "Recent administrative activity" },
  "/admin/profile":      { title: "Profile Settings",         sub: "Your account preferences" },
  "/nurse-station":      { title: "Nurse Queue",              sub: "Paid patients and vitals" },
  "/doctor/dashboard":   { title: "Doctor Dashboard",         sub: "Queued patients and consultation records" },
  "/frontdesk/dashboard":{ title: "Frontdesk Dashboard",      sub: "Confirm appointments and check-ins" },
  "/frontdesk/appointments": { title: "Frontdesk Appointments", sub: "Confirm, reschedule, and cancel visits" },
  "/dashboard":          { title: "Patient Dashboard",        sub: "Your health overview" },
};

const PROFILE_PATH = {
  Admin:   "/admin/profile",
  Doctor:  "/doctor/profile",
  Frontdesk: "/frontdesk/profile",
  Nurse:   "/nurse/profile",
  Cashier: "/cashier/profile",
  Patient: "/patient/profile",
};

export default function Topbar({ sideOpen, onToggle, pageTitle, pageSubtitle }) {
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropRef = useRef(null);
  const role = getUserRole() || "Admin";

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    const handleClick = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fullName = user ? `${user.first_name} ${user.last_name}` : role;
  const location = window.location.pathname;
  const page = PAGE_TITLES[location] || { title: pageTitle || "Dashboard", sub: pageSubtitle || today };

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
              { icon: <ProfileIcon />,  label: "My Profile",       action: () => { navigate(PROFILE_PATH[role] || "/"); setDropOpen(false); } },
              { icon: <SettingsIcon />, label: "Account Settings",  action: () => { navigate(PROFILE_PATH[role] || "/"); setDropOpen(false); } },
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
    </header>
  );
}