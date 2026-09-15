const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

// Get all expenses with optional filtering
router.get('/', expenseController.getAllExpenses);

// Get expense statistics
router.get('/stats', expenseController.getExpenseStats);

// Get expenses grouped by category
router.get('/by-category', expenseController.getExpensesByCategory);

// Get expense by ID
router.get('/:id', expenseController.getExpenseById);

// Create new expense
router.post('/', expenseController.createExpense);

// A completed expense can no longer be edited - only deleted for a
// genuine mistake (which correctly reverses its balance/CashFlow effect).
// The PUT route was removed on purpose, not just hidden in the UI.

// Delete expense
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
