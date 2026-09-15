const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES: PAYMENT_ROLES, ADMIN_ROLES } = require('../config/roles');

// GET all payments
router.get('/', authenticateToken, authorizeRoles(PAYMENT_ROLES), paymentController.getAll);

// GET payments by date range - must come before /:id
router.get('/date-range', authenticateToken, authorizeRoles(PAYMENT_ROLES), paymentController.getByDateRange);

// GET payments by invoice ID
router.get('/invoice/:invoiceId', authenticateToken, authorizeRoles(PAYMENT_ROLES), paymentController.getByInvoiceId);

// GET a single payment by id
router.get('/:id', authenticateToken, authorizeRoles(PAYMENT_ROLES), paymentController.getById);

// POST a new payment
router.post('/', authenticateToken, authorizeRoles(PAYMENT_ROLES), paymentController.create);

// A completed payment can no longer be edited - only deleted for a
// genuine mistake (which correctly reverses its balance/CashFlow effect).
// The PUT route was removed on purpose, not just hidden in the UI.

// DELETE a payment
router.delete('/:id', authenticateToken, authorizeRoles(ADMIN_ROLES), paymentController.delete);

module.exports = router;
