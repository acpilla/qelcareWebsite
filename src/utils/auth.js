// ============================================================
// FILE: src/utils/auth.js
// ============================================================

const API_URL = process.env.REACT_APP_API_URL || "https://qelcarereactweb2-production.up.railway.app";

// ── Token helpers ─────────────────────────────────────────────
export const getToken  = ()        => localStorage.getItem("token");
export const getUserRole = ()      => localStorage.getItem("role");
export const isAuthenticated = ()  => !!localStorage.getItem("token");

// ── Save login data ────────────────────────────────────────────
export const saveLoginData = (token, user) => {
  localStorage.setItem("token",   token);
  localStorage.setItem("role",    user.role);
  localStorage.setItem("userId",  user.user_id);
  localStorage.setItem("username",user.username);
  localStorage.setItem("user",    JSON.stringify(user));
  // Start the patient inactivity clock at login (see PatientIdleTimeout).
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
};

// ── Patient inactivity session timeout ────────────────────────
// Auto-logout applies ONLY to Patient accounts. Staff/Admin/Doctor/Nurse/Cashier
// keep their full token lifetime (JWT_EXPIRES_IN) and are never idle-timed-out.
export const PATIENT_IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const LAST_ACTIVITY_KEY = "qelcare_last_activity";
const SESSION_EXPIRED_KEY = "qelcare_session_expired";

// True only for a signed-in Patient — the gate for the idle watcher.
export const isPatientSession = () => isAuthenticated() && getUserRole() === "Patient";

// Log out due to inactivity: best-effort server-side token revoke, clear local
// state, flag the login screen, and send the user to /login.
export const expireSession = async () => {
  const token = getToken();
  try {
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    /* ignore network errors — we still clear locally below */
  }
  localStorage.clear();
  sessionStorage.setItem(SESSION_EXPIRED_KEY, "1"); // survives localStorage.clear()
  window.location.href = "/login";
};

// LoginScreen calls this once on mount: returns true if the previous logout was an
// inactivity timeout, then clears the one-shot flag so it does not repeat.
export const consumeSessionExpired = () => {
  const flagged = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";
  if (flagged) sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return flagged;
};

// ── Logout ────────────────────────────────────────────────────
export const logout = async () => {
  try {
    const token = getToken();
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    localStorage.clear();
    window.location.href = "/login";
  }
};

// ── Decode JWT payload (for display only — NOT for auth) ──────
export const getUserFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    const decoded = JSON.parse(json);
    return decoded.user || decoded;
  } catch {
    return null;
  }
};

// ── Authenticated fetch helper ────────────────────────────────
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // If 401, token expired — force logout
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    return;
  }

  return response;
};

export { API_URL };