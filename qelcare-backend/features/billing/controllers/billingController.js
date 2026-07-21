const Billing = require("../models/Billing");
const Appointment = require("../../appointment/models/Appointment");
const logger = require("../../../shared/utils/activityLogger");

function cleanLineItems(items) {
  return (items || []).filter((item) => Number(item.amount || item.unit_price || 0) > 0);
}

const billingController = {
  async create(req, res) {
    const { appointment_id, patient_id, line_items, payment_method } = req.body;

    if (!appointment_id || !patient_id) {
      return res.status(400).json({ success: false, message: "appointment_id and patient_id are required." });
    }
    if (!line_items || !Array.isArray(line_items) || cleanLineItems(line_items).length === 0) {
      return res.status(400).json({ success: false, message: "At least one billable line item is required." });
    }
    if (!payment_method) {
      return res.status(400).json({ success: false, message: "payment_method is required." });
    }

    try {
      const existing = await Billing.findByAppointment(appointment_id);
      if (existing && existing.status === "PAID") {
        return res.status(409).json({ success: false, message: "This appointment has already been billed." });
      }

      const appointment = await Appointment.getRawById(appointment_id);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found." });
      }
      if (Number(appointment.patient_id) !== Number(patient_id)) {
        return res.status(400).json({ success: false, message: "Patient does not match this appointment." });
      }
      if (appointment.status !== "FOR_BILLING") {
        return res.status(400).json({
          success: false,
          message: "This visit is not ready for billing. The doctor must finish the consultation first (it should be marked For Billing).",
        });
      }

      const billing = await Billing.create({
        ...req.body,
        cashier_id: req.user.user_id,
      });

      // Payment recorded -> the visit is now fully completed.
      await Appointment.completeFromBilling(appointment_id);

      await logger.log({
        userId: req.user.user_id,
        action: "BILLING_PAID",
        entityType: "billing",
        entityId: billing.id,
        description: `Payment processed OR#${billing.or_number} - PHP ${billing.total_amount}`,
        ip: logger.getIP(req),
        metadata: {
          appointment_id,
          patient_id,
          or_number: billing.or_number,
          subtotal: billing.subtotal,
          discount_amount: billing.discount_amount,
          total: billing.total_amount,
          method: billing.payment_method,
        },
      });

      res.status(201).json({
        success: true,
        message: "Payment processed.",
        data: { billing },
        billing,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Billing create error:", err);
      res.status(500).json({ success: false, message: "Failed to process payment." });
    }
  },

  async getAll(req, res) {
    try {
      const { search = "", status, page = 1, limit = 20 } = req.query;
      const result = await Billing.findAll({
        search,
        status,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Billing getAll error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch billing records." });
    }
  },

  async getById(req, res) {
    try {
      const bill = await Billing.findById(req.params.id);
      if (!bill) return res.status(404).json({ success: false, message: "Billing record not found." });
      res.json({ success: true, data: bill, billing: bill });
    } catch (err) {
      console.error("Billing getById error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch billing record." });
    }
  },

  async getByAppointment(req, res) {
    try {
      const bill = await Billing.findByAppointment(req.params.appointmentId);
      if (!bill) return res.status(404).json({ success: false, message: "No billing found for this appointment." });
      res.json({ success: true, data: bill, billing: bill });
    } catch (err) {
      console.error("Billing getByAppointment error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch billing." });
    }
  },

  async voidBill(req, res) {
    try {
      const bill = await Billing.void(req.params.id, req.user.user_id);
      if (!bill) return res.status(404).json({ success: false, message: "Billing not found or already voided." });

      await logger.log({
        userId: req.user.user_id,
        action: "BILLING_VOIDED",
        entityType: "billing",
        entityId: bill.id,
        description: `Billing OR#${bill.or_number} voided`,
        ip: logger.getIP(req),
        metadata: {
          appointment_id: bill.appointment_id,
          total: bill.total_amount,
        },
      });

      res.json({ success: true, message: "Billing voided. Appointment returned to completed/unpaid.", data: bill, billing: bill });
    } catch (err) {
      console.error("Billing void error:", err);
      res.status(500).json({ success: false, message: "Failed to void billing." });
    }
  },

  async getDashboard(req, res) {
    try {
      const [stats, recent] = await Promise.all([
        Billing.getDashboardStats(),
        Billing.getRecentTransactions(10),
      ]);

      res.json({ success: true, data: { stats, recent } });
    } catch (err) {
      console.error("Billing dashboard error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch dashboard data." });
    }
  },
};

module.exports = billingController;
