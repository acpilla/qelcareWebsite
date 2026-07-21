// ============================================================
// FILE: src/utils/adminTheme.js
// ------------------------------------------------------------
// Single source of truth for the admin design system colors.
//
// Every admin module used to declare its own near-identical
// `const C = {…}` / `const COLORS = {…}` palette with slightly
// different values (Billing was off-brand gray, Queue used a
// different blue, Reports used a brighter navy). This unifies
// them: each module now imports `C` from here.
//
// The object is a SUPERSET of every key any admin screen
// references, so a module can `import { C }` or
// `import { C as COLORS }` with no missing keys.
// ============================================================

export const C = {
  // Core ink / surfaces
  navy: "#0f2744",
  navyDark: "#0a1d35",
  ink: "#0f2744",
  text: "#5a6a7e",
  muted: "#8a97a8",
  white: "#ffffff",
  panel: "#ffffff",
  bg: "#f0f4f9",
  soft: "#f8fafd",
  rowHov: "#f6f9fd",

  // Brand blue
  blue: "#163a6b",
  blue2: "#1f4e8c",
  blueL: "#eef3fb",
  blueSoft: "#eef3fb",

  // Green / success
  green: "#1f7a52",
  greenL: "#eaf6ef",
  greenSoft: "#eaf6ef",
  ok: "#1f8a5b",

  // Teal
  teal: "#1f7a6f",
  tealL: "#eaf8f4",

  // Amber / warning
  amber: "#8a5a12",
  amberL: "#fff4de",
  amberSoft: "#fff4de",
  warn: "#a56a00",

  // Purple / violet
  purple: "#5a3a8a",
  purpleL: "#f4eefb",
  violet: "#5a3a8a",

  // Red / danger
  red: "#b63342",
  redL: "#fdeef0",
  redSoft: "#fdeef0",
  danger: "#b63342",

  // Neutral gray
  gray: "#64748b",
  graySoft: "#f1f5f9",

  // Lines / borders
  border: "#e4ecf5",
  line: "#e4ecf5",
};

// Shared elevation + radius tokens (optional helpers for new UI).
export const SHADOW = {
  card: "0 2px 10px rgba(15, 39, 68, 0.06)",
  raised: "0 8px 24px rgba(15, 39, 68, 0.12)",
  pop: "0 16px 40px rgba(15, 39, 68, 0.18)",
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
};

export default C;
