const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Both Salesman and Admin can process returns/exchanges; Contentuser cannot
// (matches the existing Record Sale / Invoices access split).
const { SALESMAN_ROLES: RETURN_ROLES } = require('../config/roles');

// GET per-item remaining-returnable quantities for an invoice
router.get('/invoice/:invoiceId/summary', authenticateToken, authorizeRoles(RETURN_ROLES), returnController.getSummary);

// GET all returns (with refunds) - used by the Dashboard to net today's
// refunds out of "Today's Sales"
router.get('/', authenticateToken, authorizeRoles(RETURN_ROLES), returnController.getAll);

// POST process a return/exchange (one or more items, one transaction)
router.post('/', authenticateToken, authorizeRoles(RETURN_ROLES), returnController.create);

// GET a single past return's full detail
router.get('/:id', authenticateToken, authorizeRoles(RETURN_ROLES), returnController.getById);

module.exports = router;
