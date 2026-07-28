// FILE: src/components/Layout/MainLayout.js
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./adminPolish.css";

/**
 * MainLayout — wraps every protected page.
 * Desktop: sidebar sits inline (collapsible to an icon rail).
 * Phone/tablet (<=900px): sidebar becomes an off-canvas drawer with an overlay,
 * and the content area goes full-width. See src/responsive.css for the .qc-* rules.
 */
export default function MainLayout({ children, pageTitle, pageSubtitle }) {
  const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 900;
  const [sideOpen, setSideOpen] = useState(() => !isMobile());

  // Only react when crossing the 900px breakpoint (not on every resize), so a
  // desktop user's collapsed icon rail is preserved while they resize.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e) => setSideOpen(!e.matches); // mobile -> closed, desktop -> open
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler);
    };
  }, []);

  const closeOnMobile = () => { if (isMobile()) setSideOpen(false); };

  return (
    <div className="qc-shell" style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f0f4f9",
      fontFamily: '"Segoe UI", system-ui, Arial, sans-serif',
      color: "#182433",
    }}>
      <Sidebar
        open={sideOpen}
        onToggle={() => setSideOpen((v) => !v)}
        onNavigate={closeOnMobile}
      />

      {/* Dim overlay — only rendered visible on mobile when the drawer is open
          (hidden on desktop via .qc-overlay { display:none }). */}
      <div
        className={`qc-overlay${sideOpen ? " qc-overlay--show" : ""}`}
        onClick={() => setSideOpen(false)}
        aria-hidden="true"
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          sideOpen={sideOpen}
          onToggle={() => setSideOpen((v) => !v)}
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
        />
        <main className="qc-main" style={{ flex: 1, padding: "28px 28px 40px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
