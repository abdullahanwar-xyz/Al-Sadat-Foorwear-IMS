const express = require('express');
const router = express.Router();
const supplierTransactionController = require('../controllers/supplierTransactionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

// Get dashboard statistics
router.get('/dashboard/stats', supplierTransactionController.getDashboardStats);

// Get all transactions
router.get('/', supplierTransactionController.getAllTransactions);

// Get single transaction by ID
router.get('/:id', supplierTransactionController.getTransactionById);

// Create new transaction
router.post('/', supplierTransactionController.createTransaction);

// Update transaction
router.put('/:id', supplierTransactionController.updateTransaction);

// Delete transaction
router.delete('/:id', supplierTransactionController.deleteTransaction);

module.exports = router;
