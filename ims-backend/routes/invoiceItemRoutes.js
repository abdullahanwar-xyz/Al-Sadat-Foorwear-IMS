const express = require('express');
const router = express.Router();
const invoiceItemController = require('../controllers/invoiceItemController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

router.use(authenticateToken, authorizeRoles(ADMIN_ROLES));

// GET all invoice items
router.get('/', invoiceItemController.getAll);

// GET items by invoice ID - move above /:id
router.get('/invoice/:invoiceId', invoiceItemController.getByInvoiceId);

// GET a single invoice item by id
router.get('/:id', invoiceItemController.getById);

// POST a new invoice item
router.post('/', invoiceItemController.create);

// PUT/update an invoice item
router.put('/:id', invoiceItemController.update);

// DELETE an invoice item
router.delete('/:id', invoiceItemController.delete);

// Update quantity of an invoice item
router.patch('/:id/quantity', invoiceItemController.updateQuantity);

module.exports = router;
