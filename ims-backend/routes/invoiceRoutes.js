const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES: READ_ROLES, ADMIN_ROLES } = require('../config/roles');

// GET all invoices
router.get('/', authenticateToken, authorizeRoles(READ_ROLES), invoiceController.getAll);

// GET invoices by date range - must come before /:id
router.get('/date-range', authenticateToken, authorizeRoles(READ_ROLES), invoiceController.getByDateRange);

// GET invoices by customer ID
router.get('/customer/:customerId', authenticateToken, authorizeRoles(READ_ROLES), invoiceController.getByCustomerId);

// GET a single invoice by id
router.get('/:id', authenticateToken, authorizeRoles(READ_ROLES), invoiceController.getById);

// POST a new invoice
router.post('/', authenticateToken, authorizeRoles(ADMIN_ROLES), invoiceController.create);

// POST a new invoice with items
router.post('/with-items', authenticateToken, authorizeRoles(ADMIN_ROLES), invoiceController.createWithItems);

// PUT/update an invoice
router.put('/:id', authenticateToken, authorizeRoles(ADMIN_ROLES), invoiceController.update);

// PATCH/update invoice status
router.patch('/:id/status', authenticateToken, authorizeRoles(ADMIN_ROLES), invoiceController.updateStatus);

// DELETE an invoice
router.delete('/:id', authenticateToken, authorizeRoles(ADMIN_ROLES), invoiceController.delete);

module.exports = router;
