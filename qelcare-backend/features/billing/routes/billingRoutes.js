// ============================================================
// FILE: qelcare-backend/features/billing/routes/billingRoutes.js
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/billingController');
const { authenticate, authorize } = require('../../../shared/middleware/tokenMiddleware');

router.use(authenticate);

router.get('/dashboard',                  authorize(['Admin','Cashier']),         ctrl.getDashboard);
router.get('/',                           authorize(['Admin','Cashier']),         ctrl.getAll);
router.post('/',                          authorize(['Admin','Cashier']),         ctrl.create);
router.get('/appointment/:appointmentId', authorize(['Admin','Cashier','Doctor','Nurse']), ctrl.getByAppointment);
router.get('/:id',                        authorize(['Admin','Cashier']),         ctrl.getById);
router.patch('/:id/void',                 authorize(['Admin','Cashier']),         ctrl.voidBill);

module.exports = router;