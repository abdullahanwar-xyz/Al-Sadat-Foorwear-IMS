const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES: SALE_ROLES, ADMIN_ROLES } = require('../config/roles');

// POST a new sale (invoice) with immediate exact-size stock deduction
router.post('/', authenticateToken, authorizeRoles(SALE_ROLES), saleController.create);

// POST cancel a sale: restore stock and soft-cancel the invoice
router.post('/:id/cancel', authenticateToken, authorizeRoles(ADMIN_ROLES), saleController.cancel);

module.exports = router;
