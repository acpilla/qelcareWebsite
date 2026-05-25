import React, { useState } from "react";

const styles = `
:root {
  --navy-950: #081a2f;
  --navy-900: #0d2748;
  --navy-800: #123157;
  --navy-700: #18375f;
  --blue-600: #2f6fed;
  --blue-100: #eaf2ff;
  --green-600: #17835a;
  --green-100: #eaf8f1;
  --slate-900: #172033;
  --slate-700: #334155;
  --slate-500: #667085;
  --slate-400: #8a99ac;
  --line: #dde7f3;
  --line-strong: #bfd0e8;
  --surface: #ffffff;
  --surface-soft: #f7faff;
  --page: #f3f7fc;
  --shadow-xl: 0 34px 90px rgba(8, 26, 47, 0.18);
  --shadow-lg: 0 22px 48px rgba(8, 26, 47, 0.12);
  --shadow-md: 0 14px 30px rgba(8, 26, 47, 0.08);
  --radius-2xl: 32px;
  --radius-xl: 24px;
  --radius-lg: 18px;
  --radius-md: 14px;
  --transition: 180ms ease;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
  color: var(--slate-900);
  background:
    radial-gradient(circle at 10% 10%, rgba(47, 111, 237, 0.14), transparent 28%),
    radial-gradient(circle at 92% 78%, rgba(24, 55, 95, 0.14), transparent 30%),
    linear-gradient(180deg, #f9fbff 0%, var(--page) 100%);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.verification-shell {
  width: min(100%, 1180px);
  min-height: 720px;
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.74);
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(18px);
}

.brand-panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  padding: 44px 42px;
  overflow: hidden;
  color: #ffffff;
  background:
    linear-gradient(145deg, rgba(8, 26, 47, 0.98), rgba(24, 55, 95, 0.96)),
    var(--navy-700);
}

.brand-panel::before,
.brand-panel::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  z-index: -1;
}

.brand-panel::before {
  width: 430px;
  height: 430px;
  top: -170px;
  right: -150px;
  background: radial-gradient(circle, rgba(255,255,255,0.17), rgba(255,255,255,0.04) 62%, transparent 72%);
}

.brand-panel::after {
  width: 280px;
  height: 280px;
  left: -100px;
  bottom: -100px;
  background: radial-gradient(circle, rgba(47,111,237,0.32), rgba(255,255,255,0.05) 58%, transparent 74%);
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 1.02rem;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.brand-mark {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
  color: #ffffff;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-main {
  max-width: 540px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 18px;
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.eyebrow::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #73d8a3;
  box-shadow: 0 0 0 5px rgba(115, 216, 163, 0.13);
}

.brand-main h1 {
  max-width: 530px;
  margin-bottom: 18px;
  font-size: clamp(2.2rem, 4vw, 3.55rem);
  line-height: 1.02;
  letter-spacing: -0.06em;
}

.brand-main p {
  max-width: 520px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 1rem;
  line-height: 1.75;
}

.trust-grid {
  display: grid;
  gap: 14px;
  margin-top: 34px;
}

.trust-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 14px;
  align-items: start;
  padding: 17px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(14px);
}

.trust-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.trust-icon svg {
  width: 20px;
  height: 20px;
}

.trust-card strong {
  display: block;
  margin-bottom: 5px;
  font-size: 0.97rem;
  letter-spacing: -0.01em;
}

.trust-card span {
  display: block;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.88rem;
  line-height: 1.58;
}

.brand-footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.9rem;
  line-height: 1.55;
}

.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.97));
}

.verification-card {
  width: 100%;
  max-width: 620px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  color: var(--navy-700);
  font-size: 0.92rem;
  font-weight: 850;
  transition: color var(--transition), transform var(--transition);
  background: transparent;
  cursor: pointer;
}

.back-link svg {
  width: 18px;
  height: 18px;
}

.back-link:hover {
  color: var(--blue-600);
  transform: translateX(-1px);
}

.card-surface {
  padding: 32px;
  border-radius: 30px;
  background: var(--surface);
  border: 1px solid #e5edf7;
  box-shadow: var(--shadow-lg);
}

.header-block {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}

.status-pill {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--green-100);
  color: var(--green-600);
  border: 1px solid #cfeedd;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.status-pill::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.header-block h2 {
  color: var(--navy-950);
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  line-height: 1.08;
  letter-spacing: -0.055em;
}

.header-block p {
  max-width: 560px;
  color: var(--slate-500);
  font-size: 0.98rem;
  line-height: 1.68;
}

.account-preview {
  display: grid;
  gap: 10px;
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(180deg, #f9fbff 0%, #f4f8fe 100%);
  border: 1px solid var(--line);
}

.preview-row {
  display: grid;
  grid-template-columns: 154px 1fr;
  gap: 12px;
  align-items: center;
  padding: 6px 2px;
  font-size: 0.92rem;
}

.preview-row span {
  color: var(--slate-500);
  font-weight: 750;
}

.preview-row strong {
  color: var(--slate-900);
  font-weight: 850;
  text-align: right;
  word-break: break-word;
}

.method-group {
  display: grid;
  gap: 14px;
  margin-bottom: 22px;
}

.method-option {
  position: relative;
  display: block;
}

.method-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.method-card {
  display: grid;
  grid-template-columns: 58px 1fr 28px;
  gap: 16px;
  align-items: center;
  min-height: 112px;
  padding: 19px;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  cursor: pointer;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition), background var(--transition);
}

.method-card:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.method-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 19px;
  color: var(--navy-700);
  background: var(--blue-100);
  border: 1px solid #d7e7ff;
}

.method-text strong {
  display: block;
  margin-bottom: 6px;
  color: var(--navy-950);
  font-size: 1.02rem;
  letter-spacing: -0.01em;
}

.method-text span {
  display: block;
  color: var(--slate-500);
  font-size: 0.9rem;
  line-height: 1.55;
}

.method-radio {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid #c7d5e8;
  transition: border-color var(--transition), background var(--transition);
}

.method-radio::after {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  transform: scale(0);
  transition: transform var(--transition);
}

.method-option input:checked + .method-card {
  border-color: #8eb0e8;
  background: linear-gradient(180deg, #f5f9ff 0%, #eef5ff 100%);
  box-shadow: 0 16px 34px rgba(24, 55, 95, 0.12);
}

.method-option input:checked + .method-card .method-radio {
  border-color: var(--navy-700);
  background: var(--navy-700);
}

.method-option input:checked + .method-card .method-radio::after {
  transform: scale(1);
}

.method-option input:focus-visible + .method-card {
  outline: 4px solid rgba(58, 123, 236, 0.16);
  outline-offset: 3px;
}

.security-note {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 12px;
  align-items: start;
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 18px;
  background: #f8fbff;
  border: 1px solid #e2ebf7;
}

.note-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: var(--navy-700);
  background: #eef5ff;
  border: 1px solid #d9e8ff;
}

.note-icon svg {
  width: 20px;
  height: 20px;
}

.security-note strong {
  display: block;
  margin-bottom: 4px;
  color: var(--navy-950);
  font-size: 0.92rem;
}

.security-note span {
  display: block;
  color: var(--slate-500);
  font-size: 0.88rem;
  line-height: 1.55;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  min-height: 54px;
  padding: 0 22px;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 900;
  transition: transform var(--transition), box-shadow var(--transition), background var(--transition), border-color var(--transition);
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:focus-visible,
.back-link:focus-visible {
  outline: 4px solid rgba(58, 123, 236, 0.16);
  outline-offset: 3px;
}

.btn-secondary {
  color: var(--navy-700);
  background: #f0f5fb;
  border: 1px solid #dbe6f4;
}

.btn-secondary:hover {
  background: #e6eef8;
  border-color: #cbd9ea;
}

.btn-primary {
  min-width: 224px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--navy-700) 0%, var(--navy-900) 100%);
  box-shadow: 0 16px 28px rgba(24, 55, 95, 0.20);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--navy-800) 0%, var(--navy-950) 100%);
  box-shadow: 0 20px 34px rgba(24, 55, 95, 0.26);
}

.support-copy {
  margin-top: 20px;
  color: var(--slate-500);
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.65;
}

.support-copy a,
.support-copy button {
  color: var(--navy-700);
  font-weight: 850;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.support-copy a:hover,
.support-copy button:hover {
  color: var(--blue-600);
  text-decoration: underline;
}

@media (max-width: 980px) {
  .verification-shell {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 460px;
  }
}

@media (max-width: 680px) {
  .page {
    padding: 14px;
  }

  .brand-panel,
  .form-panel {
    padding: 26px;
  }

  .verification-shell,
  .card-surface {
    border-radius: 24px;
  }

  .card-surface {
    padding: 24px;
  }

  .preview-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .preview-row strong {
    text-align: left;
  }

  .method-card {
    grid-template-columns: 52px 1fr;
    align-items: start;
  }

  .method-icon {
    width: 52px;
    height: 52px;
  }

  .method-radio {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }

  .brand-footer {
    flex-direction: column;
  }
}
`;

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 4v5c0 4.5-2.9 7.9-7 9-4.1-1.1-7-4.5-7-9V7l7-4z" />
      <path d="M9.5 12.2l1.8 1.8 3.7-4.2" />
    </svg>
  );
}

function LinesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l4 4L19 6" />
      <path d="M21 12a9 9 0 1 1-5.3-8.2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4.5 7.5 12 13l7.5-5.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function ShieldAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 4v5c0 4.5-2.9 7.9-7 9-4.1-1.1-7-4.5-7-9V7l7-4z" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

const trustCards = [
  {
    icon: <ShieldCheckIcon />,
    title: "Secure code delivery",
    body: "A time-limited code is sent only to the contact method registered during account creation.",
  },
  {
    icon: <LinesIcon />,
    title: "Simple recovery option",
    body: "Use email when your phone is unavailable, or choose phone verification when you cannot access your inbox.",
  },
  {
    icon: <CheckCircleIcon />,
    title: "Ready for activation",
    body: "Once verified, the account can proceed to final activation and patient portal access.",
  },
];

const methods = [
  {
    value: "email",
    icon: <EnvelopeIcon />,
    title: "Send code to email",
    body: "Receive the one-time verification code through your registered email address.",
  },
  {
    value: "phone",
    icon: <PhoneIcon />,
    title: "Send code to phone number",
    body: "Receive the one-time verification code through SMS on your registered phone number.",
  },
];

function BrandPanel() {
  return (
    <aside className="brand-panel">
      <div className="brand-top">
        <div className="brand-mark" aria-hidden="true">
          <PlusIcon />
        </div>
        <span>QELCare Portal</span>
      </div>

      <div className="brand-main">
        <div className="eyebrow">Account verification</div>
        <h1>Choose a secure way to verify your account.</h1>
        <p>
          After registration, QELCare verifies ownership of the contact details on file.
          Select the method that is most convenient for receiving your one-time verification code.
        </p>

        <div className="trust-grid">
          {trustCards.map((card) => (
            <div className="trust-card" key={card.title}>
              <div className="trust-icon" aria-hidden="true">{card.icon}</div>
              <div>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="brand-footer">
        <span>QELCare Multispecialty Clinic Management Portal</span>
        <span>Patient onboarding verification</span>
      </div>
    </aside>
  );
}

function VerificationMethodCard({ method, selectedMethod, onChange }) {
  return (
    <label className="method-option">
      <input
        type="radio"
        name="verification_method"
        value={method.value}
        checked={selectedMethod === method.value}
        onChange={() => onChange(method.value)}
      />
      <span className="method-card">
        <span className="method-icon" aria-hidden="true">{method.icon}</span>
        <span className="method-text">
          <strong>{method.title}</strong>
          <span>{method.body}</span>
        </span>
        <span className="method-radio" aria-hidden="true" />
      </span>
    </label>
  );
}

function VerificationForm() {
  const [selectedMethod, setSelectedMethod] = useState("email");

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextRoute = selectedMethod === "email"
      ? "/email-verification-code"
      : "/phone-verification-code";

    window.alert(`Continue verification through ${selectedMethod}. Route target: ${nextRoute}`);
  };

  return (
    <section className="form-panel">
      <div className="verification-card">
        <button className="back-link" type="button" onClick={goBack}>
          <BackIcon />
          Back
        </button>

        <div className="card-surface">
          <div className="header-block">
            <div className="status-pill">Registration received</div>
            <h2>Try another verification method</h2>
            <p>
              Select where QELCare should send your verification code. This step confirms
              that the contact information used during registration belongs to you.
            </p>
          </div>

          <div className="account-preview" aria-label="Registered account details">
            <div className="preview-row">
              <span>Registered email</span>
              <strong>sarah@email.com</strong>
            </div>
            <div className="preview-row">
              <span>Registered phone</span>
              <strong>+63 912 345 6789</strong>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="method-group" role="radiogroup" aria-label="Verification method">
              {methods.map((method) => (
                <VerificationMethodCard
                  key={method.value}
                  method={method}
                  selectedMethod={selectedMethod}
                  onChange={setSelectedMethod}
                />
              ))}
            </div>

            <div className="security-note">
              <div className="note-icon" aria-hidden="true">
                <ShieldAlertIcon />
              </div>
              <div>
                <strong>Verification codes are time-limited</strong>
                <span>For your security, do not share your code with anyone. QELCare staff will never ask for your one-time code.</span>
              </div>
            </div>

            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={goBack}>Cancel</button>
              <button type="submit" className="btn btn-primary">Continue verification</button>
            </div>
          </form>

          <p className="support-copy">
            Having trouble verifying your account? <a href="#support">Contact clinic support</a> or request assistance from the front desk.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function QelCareTryAnotherWayReact() {
  return (
    <>
      <style>{styles}</style>
      <main className="page">
        <section className="verification-shell">
          <BrandPanel />
          <VerificationForm />
        </section>
      </main>
    </>
  );
}
