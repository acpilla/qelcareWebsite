export const roleAccess = {
  Admin: ["dashboard", "user-management", "medical-records", "appointments", "reports", "billing", "profile-settings"],
  Doctor: ["dashboard", "appointments", "medical-records", "patient-results", "profile-settings"],
  Frontdesk: ["dashboard", "patients", "appointments", "queue-display", "profile-settings"],
  Nurse: ["dashboard", "nurse-queue", "patient-vitals", "appointments", "profile-settings"],
  Cashier: ["dashboard", "billing", "transaction-history", "profile-settings"],
  Patient: ["dashboard", "my-appointments", "my-records", "medical-results", "my-medications", "profile-settings"],
};

export const canAccess = (role, page) => {
  return roleAccess[role]?.includes(page) || false;
};