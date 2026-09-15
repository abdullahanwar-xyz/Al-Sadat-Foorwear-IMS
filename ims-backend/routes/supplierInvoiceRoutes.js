const express = require('express');
const router = express.Router();
const supplierInvoiceController = require('../controllers/supplierInvoiceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

// Get all supplier invoices with optional filtering
router.get('/', supplierInvoiceController.getAllSupplierInvoices);

// Get supplier invoice statistics
router.get('/stats', supplierInvoiceController.getSupplierInvoiceStats);

// Get pending invoices (for payables report)
router.get('/pending', supplierInvoiceController.getPendingInvoices);

// Get supplier invoice by ID
router.get('/:id', supplierInvoiceController.getSupplierInvoiceById);

// Create new supplier invoice
router.post('/', supplierInvoiceController.createSupplierInvoice);

// Update supplier invoice
router.put('/:id', supplierInvoiceController.updateSupplierInvoice);

// Delete supplier invoice
router.delete('/:id', supplierInvoiceController.deleteSupplierInvoice);

module.exports = router;
