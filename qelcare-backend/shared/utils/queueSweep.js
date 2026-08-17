// ============================================================================
// Stale live-queue sweep
// ----------------------------------------------------------------------------
// Auto-resolves stale queue entries / IN_QUEUE appointments to NO_SHOW (via
// Queue.autoNoShowStale) and notifies the affected patients. Safe to call from
// the hourly background job or lazily when staff open the appointments / queue
// screens — Queue.autoNoShowStale only returns rows it actually changed, so the
// same no-show is never notified twice.
// ============================================================================
const Queue = require("../../features/queue/models/Queue");
const Notification = require("../../features/notification/models/Notification");
const pool = require("../../config/database");

const APPT_ROUTE_BY_ROLE = {
  Admin: "/admin/appointments",
  Frontdesk: "/frontdesk/appointments",
  Doctor: "/doctor/appointments",
  Nurse: "/nurse/appointments",
  Cashier: "/cashier/dashboard",
  Patient: "/patient/appointments",
};

async function linkForUser(userId) {
  try {
    const result = await pool.query(
      `SELECT r.role_name AS role
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.role_id
        WHERE u.user_id = $1`,
      [userId]
    );
    return APPT_ROUTE_BY_ROLE[result.rows[0]?.role] || "/patient/appointments";
  } catch (err) {
    return "/patient/appointments";
  }
}

async function sweepStaleQueue(options = {}) {
  const result = await Queue.autoNoShowStale(options);

  for (const appt of result.appointments || []) {
    if (!appt.booked_by) continue;
    try {
      const link = await linkForUser(appt.booked_by);
      await Notification.create({
        user_id: appt.booked_by,
        type: "appointment_status",
        title: "Appointment marked no-show",
        message: `Appointment #${appt.id} on ${appt.date} at ${appt.time} was marked as a no-show because it was not attended. You can rebook or walk in anytime.`,
        link,
        appointment_id: appt.id,
        metadata: { auto: true, reason: "no_show" },
      });
    } catch (err) {
      console.error("No-show notify error:", err.message);
    }
  }

  return result;
}

module.exports = { sweepStaleQueue };
