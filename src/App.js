import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import LoginScreen from "./components/Login/LoginScreen";
import ForgotPassScreen from "./components/ForgotPassword/ForgotPassScreen";
import EmailVerification from "./components/Verifications/EmailVerification";
import RegisterScreen from "./components/Register/RegisterScreen";

import AdminDashboard from "./components/AdminFeatures/CreateUserAcc/AdminDashboard";
import ManageUsers from "./components/AdminFeatures/ManageUsers/ManageUsers";
import AdminAppointments from "./components/AdminFeatures/AppointmentManagement/AdminAppointments";
import AdminBilling from "./components/AdminFeatures/Billing/AdminBilling";
import ProfileSettings from "./components/AdminFeatures/ProfileSettings/ProfileSettings";
import AnalyticsReports from "./components/AdminFeatures/ReportsAndAnalytics/index";
import { AdminLogs, AdminPatients, AdminQueue, AdminRecords } from "./components/AdminFeatures/Placeholders";

import QueueDisplayScreen from "./components/QueueDisplay/QueueDisplayScreen";
import QNurseStationVitals from "./components/Nurse/QNurseStationVitals";
import SpecialtyQueueScreen from "./components/NurseQueue/SpecialtyQueueScreen";
import DoctorDashboard from "./components/DoctorSide/DoctorDashboard";
import FrontDesk from "./components/FrontDesk/ManageDoctor/FrontDesk";
import CashierDashboard from "./components/Cashier/CashierDashboard";
import CashierBilling from "./components/Cashier/CashierBilling";

import UserScreen from "./components/UserSide/UserScreen";
import AppointmentList from "./components/UserSide/AppointmentList";
import UserBooking from "./components/UserSide/UserBooking";
import MedicalRecords from "./components/UserSide/MedicalRecords";
import MedicationScreen from "./components/UserSide/MedicationScreen";
import PatientResults from "./components/UserSide/PatientResults";
import MainLayout from "./components/Layout/MainLayout";
import LandingPage from "./components/LandingPage/LandingPage";

import { getUserRole, isAuthenticated } from "./utils/auth";

const SPECIALTIES = [
  { label: "ENT", slug: "ent", color: "#14536b" },
  { label: "Cardiology", slug: "cardiology", color: "#163a6b" },
  { label: "Gastroenterology", slug: "gastroenterology", color: "#176b45" },
  { label: "General Medicine", slug: "general-medicine", color: "#5b4aa0" },
  { label: "Rehabilitation Medicine", slug: "rehabilitation-medicine", color: "#1f6b58" },
  { label: "Obstetrics & Gynecology", slug: "ob-gyne", color: "#8a2f62" },
  { label: "Pediatrics", slug: "pediatrics", color: "#9a6500" },
  { label: "Psychiatry", slug: "psychiatry", color: "#4d4f9f" },
];

function ProtectedRoute({ children, allowedRoles }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (allowedRoles) {
    const role = getUserRole();
    if (!allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  }
  return children;
}

function RoleRedirect() {
  const role = getUserRole();
  const redirectMap = {
    Admin: "/admin/dashboard",
    Doctor: "/doctor/dashboard",
    Nurse: "/nurse/queue",
    Cashier: "/cashier/dashboard",
    Patient: "/dashboard",
    Frontdesk: "/frontdesk/dashboard",
  };
  return <Navigate to={redirectMap[role] || "/login"} replace />;
}

const guard = (roles, element) => <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>;

function NurseQueueHub() {
  const navigate = useNavigate();
  return (
    <MainLayout pageTitle="Nurse Queue" pageSubtitle="Select a specialty queue">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
        {SPECIALTIES.map((specialty) => (
          <button
            key={specialty.slug}
            type="button"
            onClick={() => navigate(`/nurse/queue/${specialty.slug}`)}
            style={{
              minHeight: 102,
              padding: 16,
              borderRadius: 8,
              border: `1px solid ${specialty.color}33`,
              background: "#fff",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(15,23,42,.04)",
              fontFamily: "inherit",
            }}
          >
            <div style={{ color: specialty.color, fontSize: 15, fontWeight: 900 }}>{specialty.label}</div>
            <div style={{ color: "#6b778c", fontSize: 12, marginTop: 8 }}>Open live queue</div>
          </button>
        ))}
      </div>
    </MainLayout>
  );
}

function Unauthorized() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>Access Denied</h2>
      <p>You do not have permission to view this page.</p>
      <a href="/redirect">Back to dashboard</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<ForgotPassScreen />} />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/redirect" element={<RoleRedirect />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/lobby/live-queue-display" element={<QueueDisplayScreen />} />

        <Route path="/admin/dashboard" element={guard(["Admin"], <AdminDashboard />)} />
        <Route path="/admin/users" element={guard(["Admin"], <ManageUsers />)} />
        <Route path="/admin/patients" element={guard(["Admin"], <AdminPatients />)} />
        <Route path="/admin/appointments" element={guard(["Admin"], <AdminAppointments />)} />
        <Route path="/admin/queue" element={guard(["Admin"], <AdminQueue />)} />
        <Route path="/admin/records" element={guard(["Admin"], <AdminRecords />)} />
        <Route path="/admin/billing" element={guard(["Admin"], <AdminBilling />)} />
        <Route path="/admin/reports" element={guard(["Admin"], <AnalyticsReports />)} />
        <Route path="/admin/logs" element={guard(["Admin"], <AdminLogs />)} />
        <Route path="/admin/profile" element={guard(["Admin"], <ProfileSettings />)} />

        <Route path="/frontdesk/dashboard" element={guard(["Frontdesk", "Admin"], <FrontDesk />)} />
        <Route
          path="/frontdesk/appointments"
          element={guard(["Frontdesk", "Admin"], (
            <MainLayout pageTitle="Frontdesk Appointments" pageSubtitle="Confirm, reschedule, and cancel appointments">
              <AppointmentList />
            </MainLayout>
          ))}
        />
        <Route path="/frontdesk/patients" element={guard(["Frontdesk", "Admin"], <AdminPatients />)} />
        <Route path="/frontdesk/profile" element={guard(["Frontdesk"], <ProfileSettings />)} />

        <Route path="/nurse-station" element={guard(["Nurse", "Admin"], <QNurseStationVitals />)} />
        <Route path="/nurse/vitals" element={guard(["Nurse", "Admin"], <QNurseStationVitals />)} />
        <Route path="/nurse/queue" element={guard(["Nurse", "Admin"], <NurseQueueHub />)} />
        {SPECIALTIES.map((specialty) => (
          <Route
            key={specialty.slug}
            path={`/nurse/queue/${specialty.slug}`}
            element={guard(["Nurse", "Admin"], <SpecialtyQueueScreen slug={specialty.slug} specialtyName={specialty.label} />)}
          />
        ))}
        <Route
          path="/nurse/appointments"
          element={guard(["Nurse", "Admin"], (
            <MainLayout pageTitle="Appointments" pageSubtitle="View scheduled appointments">
              <AppointmentList />
            </MainLayout>
          ))}
        />
        <Route path="/nurse/profile" element={guard(["Nurse"], <ProfileSettings />)} />

        <Route path="/doctor/dashboard" element={guard(["Doctor", "Admin"], <DoctorDashboard />)} />
        <Route
          path="/doctor/appointments"
          element={guard(["Doctor", "Admin"], (
            <MainLayout pageTitle="Appointments" pageSubtitle="Assigned appointments">
              <AppointmentList />
            </MainLayout>
          ))}
        />
        <Route
          path="/doctor/records"
          element={guard(["Doctor", "Admin"], (
            <MainLayout pageTitle="Medical Records" pageSubtitle="Create and review consultation records">
              <MedicalRecords />
            </MainLayout>
          ))}
        />
        <Route path="/doctor/profile" element={guard(["Doctor"], <ProfileSettings />)} />

        <Route path="/cashier/dashboard" element={guard(["Cashier", "Admin"], <CashierDashboard />)} />
        <Route path="/cashier/billing" element={guard(["Cashier", "Admin"], <CashierBilling />)} />
        <Route path="/cashier/profile" element={guard(["Cashier"], <ProfileSettings />)} />

        <Route path="/dashboard" element={guard(["Patient", "Admin"], <UserScreen />)} />
        <Route
          path="/patient/appointments"
          element={guard(["Patient", "Admin"], (
            <MainLayout pageTitle="My Appointments" pageSubtitle="View your clinic appointments">
              <AppointmentList />
            </MainLayout>
          ))}
        />
        <Route
          path="/patient/appointments/book"
          element={guard(["Patient", "Admin"], (
            <MainLayout pageTitle="Book Appointment" pageSubtitle="Request a consultation schedule">
              <UserBooking onViewAppointments={() => { window.location.href = "/patient/appointments"; }} />
            </MainLayout>
          ))}
        />
        <Route
          path="/patient/records"
          element={guard(["Patient", "Admin"], (
            <MainLayout pageTitle="My Records" pageSubtitle="Completed consultation results">
              <MedicalRecords />
            </MainLayout>
          ))}
        />
        <Route
          path="/patient/results"
          element={guard(["Patient"], (
            <MainLayout pageTitle="Medical Results" pageSubtitle="Track uploaded lab and diagnostic results">
              <PatientResults />
            </MainLayout>
          ))}
        />
        <Route
          path="/patient/medications"
          element={guard(["Patient", "Admin"], (
            <MainLayout pageTitle="My Medications" pageSubtitle="Prescriptions from medical records">
              <MedicationScreen />
            </MainLayout>
          ))}
        />
        <Route path="/patient/profile" element={guard(["Patient"], <ProfileSettings />)} />

        <Route path="*" element={<Navigate to="/redirect" replace />} />
      </Routes>
    </BrowserRouter>
  );
}