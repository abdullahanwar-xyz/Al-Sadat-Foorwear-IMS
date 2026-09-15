const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

// Get all suppliers
router.get('/', supplierController.getAllSuppliers);

// Get single supplier by ID
router.get('/:id', supplierController.getSupplierById);

// Get supplier ledger
router.get('/:id/ledger', supplierController.getSupplierLedger);

// Create new supplier
router.post('/', supplierController.createSupplier);

// Update supplier
router.put('/:id', supplierController.updateSupplier);

// Delete supplier
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;
