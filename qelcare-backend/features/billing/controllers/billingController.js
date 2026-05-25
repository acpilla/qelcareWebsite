// ============================================================
// FILE: qelcare-backend/features/billing/controllers/billingController.js
// ============================================================
const Billing = require('../models/Billing');
const Appointment = require('../../appointment/models/Appointment');
const Queue = require('../../queue/models/Queue');
const logger = require('../../../shared/utils/activityLogger');

const billingController = {
 async create(req, res) {
 const { appointment_id, patient_id, line_items, payment_method, amount_tendered } = req.body;
 if (!appointment_id || !patient_id) {
 return res.status(400).json({ success: false, message: 'appointment_id and patient_id are required.' });
 }
 if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
 return res.status(400).json({ success: false, message: 'At least one line item is required.' });
 }
 if (!payment_method) {
 return res.status(400).json({ success: false, message: 'payment_method is required.' });
 }
 try {
 // Check appointment isn't already paid
 const existing = await Billing.findByAppointment(appointment_id);
 if (existing && existing.status === 'PAID') {
 return res.status(409).json({ success: false, message: 'This appointment has already been billed.' });
 }

 const appointment = await Appointment.getRawById(appointment_id);
 if (!appointment) {
 return res.status(404).json({ success: false, message: 'Appointment not found.' });
 }
 if (Number(appointment.patient_id) !== Number(patient_id)) {
 return res.status(400).json({ success: false, message: 'Patient does not match this appointment.' });
 }
 if (appointment.status !== 'CONFIRMED') {
 return res.status(400).json({
 success: false,
 message: 'Only confirmed appointments can be paid and queued.',
 });
 }
 if (!appointment.specialty_id) {
 return res.status(400).json({
 success: false,
 message: 'Appointment has no specialty assigned and cannot enter queue.',
 });
 }

 const billing = await Billing.create({...req.body,
 cashier_id: req.user.user_id,
 });
 const queueEntry = await Queue.addToQueue(appointment_id);

 await logger.log({
 userId: req.user.user_id,
 action: 'BILLING_PAID',
 entityType: 'billing',
 entityId: billing.id,
        description: `Payment processed OR#${billing.or_number} - PHP ${billing.total_amount}`,
 ip: logger.getIP(req),
 metadata: {
 or_number: billing.or_number,
 total: billing.total_amount,
 method: payment_method,
 queue_id: queueEntry.queue_id,
 queue_number: queueEntry.queue_number,
 },
 });

 res.status(201).json({
 success: true,
 message: 'Payment processed and patient added to queue.',
 data: { billing, queue_entry: queueEntry },
 billing,
 queue_entry: queueEntry,
 });
 } catch (err) {
 console.error('Billing create error:', err);
 if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
 res.status(500).json({ success: false, message: 'Failed to process payment.' });
 }
 },

 async getAll(req, res) {
 try {
 const { search = '', status, page = 1, limit = 20 } = req.query;
 const result = await Billing.findAll({
 search, status,
 page: parseInt(page), limit: parseInt(limit),
 });
 res.json({ success: true,...result });
 } catch (err) {
 console.error('Billing getAll error:', err);
 res.status(500).json({ success: false, message: 'Failed to fetch billing records.' });
 }
 },
 async getById(req, res) {
 try {
 const bill = await Billing.findById(req.params.id);
 if (!bill) return res.status(404).json({ success: false, message: 'Billing record not found.' });
 res.json({ success: true, data: bill });
 } catch (err) {
 console.error('Billing getById error:', err);
 res.status(500).json({ success: false, message: 'Failed to fetch billing record.' });
 }
 },
 async getByAppointment(req, res) {
 try {
 const bill = await Billing.findByAppointment(req.params.appointmentId);
 if (!bill) return res.status(404).json({ success: false, message: 'No billing found for this appointment.' });
 res.json({ success: true, data: bill });
 } catch (err) {
 console.error('Billing getByAppointment error:', err);
 res.status(500).json({ success: false, message: 'Failed to fetch billing.' });
 }
 },
 async voidBill(req, res) {
 try {
 const bill = await Billing.void(req.params.id, req.user.user_id);
 if (!bill) return res.status(404).json({ success: false, message: 'Billing not found or already voided.' });
 await logger.log({
 userId: req.user.user_id,
 action: 'BILLING_VOIDED',
 entityType: 'billing',
 entityId: bill.id,
 description: `Billing OR#${bill.or_number} voided`,
 ip: logger.getIP(req),
 });
 res.json({ success: true, message: 'Billing voided.', data: bill });
 } catch (err) {
 console.error('Billing void error:', err);
 res.status(500).json({ success: false, message: 'Failed to void billing.' });
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
 console.error('Billing dashboard error:', err);
 res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
 }
 },
};
module.exports = billingController;
