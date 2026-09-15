const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES: CUSTOMER_ROLES, ADMIN_ROLES } = require('../config/roles');

// GET all customers
router.get('/', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.getAll);

// Search customers by name or contact
router.get('/search', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.searchCustomers);

// GET a single customer by id
router.get('/:id([0-9]+)', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.getById);

// GET customer with all invoices
router.get('/:customerId([0-9]+)/invoices', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.getWithInvoices);

// POST a new customer
router.post('/', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.create);

// PUT/update a customer - same role level as create: Record Sale needs
// this to sync a customer's name when an existing phone number is used
// again under a different typed name, and a Salesman can already create a
// full customer record outright, so updating one they're actively selling
// to is a strictly smaller capability.
router.put('/:id([0-9]+)', authenticateToken, authorizeRoles(CUSTOMER_ROLES), customerController.update);

// DELETE a customer
router.delete('/:id([0-9]+)', authenticateToken, authorizeRoles(ADMIN_ROLES), customerController.delete);

module.exports = router;
