// ============================================================
// FILE: src/utils/auth.js
// ============================================================

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

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