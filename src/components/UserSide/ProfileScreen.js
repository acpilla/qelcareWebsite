import React, { useEffect, useMemo, useState } from "react";

const styles = `
:root {
  --primary: #123157;
  --primary-strong: #0d2440;
  --primary-soft: #eaf2ff;
  --accent: #2f6fed;
  --header-blue: #18375f;
  --bg: #f3f6fb;
  --bg-2: #edf2f8;
  --card: #ffffff;
  --card-soft: #f8fbff;
  --border: #dfe7f2;
  --border-strong: #cad8ea;
  --text: #172033;
  --muted: #6c7a92;
  --success: #1f9d68;
  --warning: #d98b20;
  --shadow-xl: 0 30px 80px rgba(15, 23, 42, 0.10);
  --shadow-lg: 0 20px 50px rgba(15, 23, 42, 0.08);
  --shadow-md: 0 10px 24px rgba(15, 23, 42, 0.06);
  --radius-2xl: 28px;
  --radius-xl: 22px;
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 10px;
  --transition: 180ms ease;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: "Inter", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(47, 111, 237, 0.10), transparent 28%),
    linear-gradient(180deg, #f7faff 0%, #f1f5fb 100%);
  min-height: 100vh;
}

button,
input,
textarea {
  font: inherit;
}

.top-header {
  width: 100%;
  height: 72px;
  background: var(--header-blue);
  color: #ffffff;
  display: grid;
  grid-template-columns: 160px 1fr 160px;
  align-items: center;
  padding: 0 24px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.10);
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-link {
  justify-self: start;
  border: none;
  background: transparent;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 8px 0;
  transition: opacity var(--transition), transform var(--transition);
}

.back-link:hover {
  opacity: 0.85;
  transform: translateX(-1px);
}

.top-header-title {
  text-align: center;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0;
  color: #ffffff;
}

.top-header-spacer {
  width: 100%;
}

.page-shell {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.panel {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(223, 231, 242, 0.95);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
}

.profile-summary {
  border-radius: var(--radius-2xl);
  padding: 26px;
  position: sticky;
  top: 96px;
  overflow: hidden;
}

.profile-summary::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 120px;
  background: linear-gradient(135deg, #163866 0%, #18375f 100%);
  opacity: 0.98;
}

.summary-content {
  position: relative;
  z-index: 1;
}

.avatar-wrap {
  display: flex;
  justify-content: center;
  margin-top: 18px;
  margin-bottom: 18px;
}

.avatar {
  width: 102px;
  height: 102px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--primary);
  background: linear-gradient(135deg, #eff6ff, #bfdbfe);
  border: 5px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 34px rgba(18, 49, 87, 0.20);
}

.summary-name {
  text-align: center;
  margin-bottom: 6px;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--primary-strong);
}

.summary-id {
  text-align: center;
  color: var(--muted);
  font-size: 0.95rem;
  margin-bottom: 18px;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto 22px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #0f7a4f;
  border: 1px solid #cceedd;
  font-size: 0.85rem;
  font-weight: 700;
}

.status-chip::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 22px;
}

.stat-card {
  padding: 14px;
  border-radius: 16px;
  background: var(--card-soft);
  border: 1px solid var(--border);
}

.stat-label {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 0.96rem;
  font-weight: 800;
  color: var(--primary-strong);
}

.summary-list {
  display: grid;
  gap: 12px;
}

.summary-item {
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfdff 0%, #f7faff 100%);
  border: 1px solid var(--border);
}

.summary-item span {
  display: block;
}

.summary-item .label {
  font-size: 0.76rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 5px;
}

.summary-item .value {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--text);
}

.main-panel {
  border-radius: var(--radius-2xl);
  padding: 28px;
}

.main-topbar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}

.main-topbar h2 {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--primary-strong);
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}

.main-topbar p {
  color: var(--muted);
  line-height: 1.6;
  max-width: 620px;
}

.security-note {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid #dbe8ff;
  background: #f4f8ff;
  color: var(--primary);
  font-weight: 700;
  font-size: 0.9rem;
}

.security-note svg {
  flex-shrink: 0;
}

.section {
  margin-bottom: 26px;
}

.section:last-of-type {
  margin-bottom: 0;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.section-heading h3 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--primary-strong);
  letter-spacing: -0.02em;
}

.section-heading p {
  color: var(--muted);
  font-size: 0.92rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field.wide {
  grid-column: 1 / -1;
}

.field label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--muted);
  font-weight: 800;
  letter-spacing: 0.01em;
}

.field-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 62px;
  padding: 16px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid var(--border);
  transition: border-color var(--transition), transform var(--transition), box-shadow var(--transition);
}

.field-box:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.field-box.multiline {
  align-items: flex-start;
}

.field-content {
  min-width: 0;
}

.field-value {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  word-break: break-word;
  line-height: 1.5;
}

.field-meta {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.field-static .field-box {
  background: linear-gradient(180deg, #fcfdff 0%, #f7faff 100%);
}

.edit-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border: 1px solid #dbe6f5;
  border-radius: 12px;
  background: #eff5fc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform var(--transition), background var(--transition), border-color var(--transition);
}

.edit-btn:hover {
  background: #e3eefc;
  border-color: #c4d7f2;
  transform: scale(1.03);
}

.edit-btn:focus-visible,
.save-btn:focus-visible,
.btn-primary:focus-visible,
.btn-secondary:focus-visible,
.icon-btn:focus-visible,
.modal-box input:focus-visible,
.modal-box textarea:focus-visible,
.back-link:focus-visible {
  outline: 3px solid rgba(47, 111, 237, 0.18);
  outline-offset: 2px;
}

.actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.changes-note {
  color: var(--muted);
  line-height: 1.6;
  font-size: 0.92rem;
}

.actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ghost-btn,
.save-btn {
  border: none;
  border-radius: 14px;
  padding: 14px 20px;
  cursor: pointer;
  font-weight: 800;
  transition: transform var(--transition), background var(--transition), box-shadow var(--transition);
}

.ghost-btn {
  background: #eef3f9;
  color: #18375f;
}

.ghost-btn:hover {
  background: #e2ebf5;
}

.save-btn {
  min-width: 210px;
  background: linear-gradient(135deg, var(--primary) 0%, #18375f 100%);
  color: #ffffff;
  box-shadow: 0 18px 30px rgba(18, 49, 87, 0.18);
}

.save-btn:hover {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #0f2b4d 0%, #18375f 100%);
}

.modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(10, 19, 35, 0.45);
  backdrop-filter: blur(8px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.22s ease, visibility 0.22s ease;
  z-index: 1000;
}

.modal.active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.modal-box {
  width: 100%;
  max-width: 480px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid rgba(223, 231, 242, 0.95);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transform: translateY(16px) scale(0.98);
  transition: transform 0.22s ease;
}

.modal.active .modal-box {
  transform: translateY(0) scale(1);
}

.modal-header {
  padding: 22px 24px 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  border-bottom: 1px solid #edf2f8;
}

.modal-header h3 {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--primary-strong);
  margin-bottom: 6px;
  letter-spacing: -0.03em;
}

.modal-header p {
  color: var(--muted);
  line-height: 1.6;
  font-size: 0.95rem;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #f8fbff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.modal-body {
  padding: 20px 24px 24px;
}

.modal-note {
  background: #f6f9fe;
  border: 1px solid #e4ecf8;
  color: #18375f;
  border-radius: 16px;
  padding: 14px 16px;
  line-height: 1.6;
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.progress-steps {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.step-pill {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: #e8eef6;
  overflow: hidden;
  position: relative;
}

.step-pill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.2s ease;
}

.step-pill.active::after {
  transform: scaleX(1);
}

.input-group {
  display: grid;
  gap: 12px;
}

.modal-box input,
.modal-box textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 15px;
  background: #fbfdff;
  color: var(--text);
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

.modal-box textarea {
  resize: vertical;
  min-height: 112px;
}

.modal-box input:focus,
.modal-box textarea:focus {
  outline: none;
  border-color: #18375f;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(47, 111, 237, 0.10);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 800;
  cursor: pointer;
  transition: transform var(--transition), background var(--transition);
}

.btn-secondary {
  background: #eef3f8;
  color: #18375f;
}

.btn-secondary:hover {
  background: #e3eaf3;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, #18375f 100%);
  color: #ffffff;
}

.btn-primary:hover {
  transform: translateY(-1px);
}

.hidden {
  display: none !important;
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .profile-summary {
    position: static;
  }
}

@media (max-width: 768px) {
  .top-header {
    grid-template-columns: 90px 1fr 90px;
    height: 64px;
    padding: 0 14px;
  }

  .top-header-title {
    font-size: 1.15rem;
  }

  .back-link {
    font-size: 0.88rem;
  }

  .page-shell {
    padding: 28px 16px 48px;
  }

  .main-topbar,
  .section-heading,
  .actions-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-grid,
  .summary-stats {
    grid-template-columns: 1fr;
  }

  .main-panel,
  .profile-summary {
    padding: 22px;
    border-radius: 22px;
  }

  .modal {
    padding: 14px;
  }

  .modal-header,
  .modal-body {
    padding-left: 18px;
    padding-right: 18px;
  }

  .actions-right {
    width: 100%;
  }

  .ghost-btn,
  .save-btn {
    width: 100%;
  }
}
`;

const originalValues = {
  username: "sarahj",
  email: "sarah@email.com",
  phone: "+639123456789",
  address: "Manila, Philippines",
};

const staticProfile = {
  fullName: "Sarah Johnson",
  patientId: "CC-20481",
  ageLabel: "29 years old",
  age: "29",
  hmo: "Maxicare",
  nationality: "Filipino",
  birthday: "Jan 15, 1995",
  sexGender: "Female",
};

const editableFields = {
  username: {
    title: "Change Username",
    desc: "To update your username, please verify the request using your registered email address or phone number.",
    note: "A verification code will be sent to your registered contact method before your username can be changed.",
    placeholder: "Enter new username",
    verification: "Verification code / OTP has been sent to your registered email address or phone number.",
  },
  email: {
    title: "Change Email Address",
    desc: "To update your email address, verify this request using your current registered email address or phone number.",
    note: "A verification code will be sent before your new email address can be saved.",
    placeholder: "Enter new email address",
    verification: "Verification code / OTP has been sent to your registered email address.",
  },
  phone: {
    title: "Change Phone Number",
    desc: "To update your phone number, verify this request using your registered email address or current phone number.",
    note: "A verification code will be sent before your new phone number can be saved.",
    placeholder: "Enter new phone number",
    verification: "Verification code / OTP has been sent to your registered phone number.",
  },
  address: {
    title: "Change Permanent Address",
    desc: "To update your address, please verify using your registered email address or phone number.",
    note: "A verification code will be sent before your new permanent address can be saved.",
    placeholder: "Enter new address",
    verification: "Verification code / OTP has been sent to your registered email address or phone number.",
  },
};

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="#123157" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14.06 4.94l3.75 3.75" stroke="#123157" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 4v5c0 4.5-2.9 7.9-7 9-4.1-1.1-7-4.5-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 12.3l1.8 1.8 3.6-4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TopHeader() {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    <header className="top-header">
      <button className="back-link" type="button" onClick={goBack}>{"<- Back"}</button>
      <h1 className="top-header-title">My Profile</h1>
      <div className="top-header-spacer" />
    </header>
  );
}

function ProfileSummary() {
  return (
    <aside className="profile-summary panel">
      <div className="summary-content">
        <div className="avatar-wrap">
          <div className="avatar">SJ</div>
        </div>

        <h2 className="summary-name">{staticProfile.fullName}</h2>
        <p className="summary-id">Patient ID: {staticProfile.patientId}</p>
        <div className="status-chip">Verified patient account</div>

        <div className="summary-stats">
          <div className="stat-card">
            <span className="stat-label">Age</span>
            <span className="stat-value">{staticProfile.ageLabel}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">HMO</span>
            <span className="stat-value">{staticProfile.hmo}</span>
          </div>
        </div>

        <div className="summary-list">
          <div className="summary-item">
            <span className="label">Nationality</span>
            <span className="value">{staticProfile.nationality}</span>
          </div>
          <div className="summary-item">
            <span className="label">Birthday</span>
            <span className="value">{staticProfile.birthday}</span>
          </div>
          <div className="summary-item">
            <span className="label">Sex / Gender</span>
            <span className="value">{staticProfile.sexGender}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FieldBox({ label, value, meta, editable, fieldKey, wide, multiline, isStatic, onEdit }) {
  return (
    <div className={`field${wide ? " wide" : ""}${isStatic ? " field-static" : ""}`}>
      <label>{label}</label>
      <div className={`field-box${multiline ? " multiline" : ""}`}>
        <div className="field-content">
          <span className="field-value">{value}</span>
          <span className="field-meta">{meta}</span>
        </div>
        {editable && (
          <button className="edit-btn" type="button" onClick={() => onEdit(fieldKey)} aria-label={`Edit ${label}`}>
            <EditIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function AccountDetails({ profile, onEdit }) {
  return (
    <div className="section">
      <div className="section-heading">
        <div>
          <h3>Account Details</h3>
          <p>Secure account identifiers and contact information.</p>
        </div>
      </div>

      <div className="profile-grid">
        <FieldBox
          label="Username"
          value={profile.username}
          meta="Your public-facing account username"
          editable
          fieldKey="username"
          onEdit={onEdit}
        />
        <FieldBox
          label="Full Name"
          value={staticProfile.fullName}
          meta="Legal name registered in the system"
          isStatic
        />
        <FieldBox
          label="Email Address"
          value={profile.email}
          meta="Primary email for account notifications"
          editable
          fieldKey="email"
          onEdit={onEdit}
        />
        <FieldBox
          label="Phone Number"
          value={profile.phone}
          meta="Mobile number for account notifications"
          editable
          fieldKey="phone"
          onEdit={onEdit}
        />
        <FieldBox
          label="Permanent Address"
          value={profile.address}
          meta="Primary residential address on record"
          editable
          fieldKey="address"
          wide
          multiline
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}

function HealthcareInformation() {
  return (
    <div className="section">
      <div className="section-heading">
        <div>
          <h3>Healthcare Information</h3>
          <p>Reference details connected to your patient profile.</p>
        </div>
      </div>

      <div className="profile-grid">
        <FieldBox label="HMO Type" value={staticProfile.hmo} meta="Registered insurance provider" isStatic />
        <FieldBox label="Nationality" value={staticProfile.nationality} meta="Citizenship information" isStatic />
        <FieldBox label="Birthday" value={staticProfile.birthday} meta="Date of birth on file" isStatic />
        <FieldBox label="Age" value={staticProfile.age} meta="Automatically calculated" isStatic />
        <FieldBox label="Sex / Gender" value={staticProfile.sexGender} meta="Recorded patient information" isStatic />
      </div>
    </div>
  );
}

function EditModal({ modalField, step, inputValue, setInputValue, verificationCode, setVerificationCode, onClose, onContinue, onBack, onSave }) {
  const modalConfig = modalField ? editableFields[modalField] : null;
  const isOpen = Boolean(modalField);
  const isAddress = modalField === "address";

  return (
    <div
      className={`modal${isOpen ? " active" : ""}`}
      aria-hidden={!isOpen}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-header">
          <div>
            <h3 id="modalTitle">{modalConfig?.title || "Verify Change"}</h3>
            <p>{modalConfig?.desc || "Enter the required details below to continue."}</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close dialog">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="progress-steps" aria-hidden="true">
            <div className={`step-pill${step >= 1 ? " active" : ""}`} />
            <div className={`step-pill${step >= 2 ? " active" : ""}`} />
          </div>

          {step === 1 && (
            <div>
              <div className="modal-note">
                {modalConfig?.note || "For security purposes, this update requires verification before changes can be applied."}
              </div>

              <div className="input-group">
                {isAddress ? (
                  <textarea
                    value={inputValue}
                    placeholder={modalConfig?.placeholder || "Enter new address"}
                    onChange={(event) => setInputValue(event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={inputValue}
                    placeholder={modalConfig?.placeholder || "Enter new value"}
                    onChange={(event) => setInputValue(event.target.value)}
                  />
                )}
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
                <button className="btn-primary" type="button" onClick={onContinue}>Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="modal-note">
                {modalConfig?.verification || "Verification code has been sent."}
              </div>

              <div className="input-group">
                <input
                  type="text"
                  value={verificationCode}
                  placeholder="Enter verification code / OTP"
                  onChange={(event) => setVerificationCode(event.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={onBack}>Back</button>
                <button className="btn-primary" type="button" onClick={onSave}>Confirm Update</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainPanel() {
  const [profile, setProfile] = useState(originalValues);
  const [modalField, setModalField] = useState(null);
  const [modalStep, setModalStep] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const openModal = (field) => {
    setModalField(field);
    setModalStep(1);
    setInputValue(profile[field] || "");
    setVerificationCode("");
  };

  const closeModal = () => {
    setModalField(null);
    setModalStep(1);
    setInputValue("");
    setVerificationCode("");
  };

  const goToVerification = () => {
    if (!inputValue.trim()) return;
    setModalStep(2);
  };

  const saveChange = () => {
    if (!modalField || !inputValue.trim() || !verificationCode.trim()) return;
    setProfile((current) => ({ ...current, [modalField]: inputValue.trim() }));
    closeModal();
  };

  const resetEditableFields = () => {
    setProfile(originalValues);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <section className="main-panel panel">
        <div className="main-topbar">
          <div>
            <h2>Personal Information</h2>
            <p>Keep your profile up to date to ensure accurate communication, identity verification, and a smoother clinic experience.</p>
          </div>

          <div className="security-note">
            <ShieldIcon />
            Sensitive updates require verification
          </div>
        </div>

        <AccountDetails profile={profile} onEdit={openModal} />
        <HealthcareInformation />

        <div className="actions-bar">
          <p className="changes-note">Changes to contact and identity-related details are protected with a verification step before being applied.</p>
          <div className="actions-right">
            <button className="ghost-btn" type="button" onClick={resetEditableFields}>Reset</button>
            <button className="save-btn" type="button">Save Changes</button>
          </div>
        </div>
      </section>

      <EditModal
        modalField={modalField}
        step={modalStep}
        inputValue={inputValue}
        setInputValue={setInputValue}
        verificationCode={verificationCode}
        setVerificationCode={setVerificationCode}
        onClose={closeModal}
        onContinue={goToVerification}
        onBack={() => setModalStep(1)}
        onSave={saveChange}
      />
    </>
  );
}

export default function ClinicCareMyProfileReact() {
  return (
    <>
      <style>{styles}</style>
      <TopHeader />
      <div className="page-shell">
        <main className="layout">
          <ProfileSummary />
          <MainPanel />
        </main>
      </div>
    </>
  );
}