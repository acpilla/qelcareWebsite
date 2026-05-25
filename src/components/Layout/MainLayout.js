// FILE: src/components/Layout/MainLayout.js
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * MainLayout — wraps every protected page.
 * Usage:
 *   <MainLayout>
 *     <YourPageContent />
 *   </MainLayout>
 */
export default function MainLayout({ children, pageTitle, pageSubtitle }) {
  const [sideOpen, setSideOpen] = useState(true);

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f0f4f9",
      fontFamily: '"Segoe UI", system-ui, Arial, sans-serif',
      color: "#182433",
    }}>
      <Sidebar open={sideOpen} onToggle={() => setSideOpen(v => !v)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          sideOpen={sideOpen}
          onToggle={() => setSideOpen(v => !v)}
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
        />
        <main style={{ flex: 1, padding: "28px 28px 40px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}