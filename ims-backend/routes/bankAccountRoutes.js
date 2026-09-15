const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES, ADMIN_ROLES } = require('../config/roles');

// All routes require authentication
router.use(authenticateToken);

// Special routes (must be before /:id routes)
// Used by Record Sale's bank-payment option, so Salesmen need read access here.
router.get('/shop/accounts', authorizeRoles(SALESMAN_ROLES), bankAccountController.getShopBankAccounts);

// Everything else here is Accounts & Finance admin territory (viewing
// balances, editing accounts, moving money between them) - SuperAdmin or
// ShopOwner only, same as the rest of the backend module.
router.use(authorizeRoles(ADMIN_ROLES));

// CRUD routes
router.get('/', bankAccountController.getAllBankAccounts);
router.get('/:id', bankAccountController.getBankAccountById);
router.post('/', bankAccountController.createBankAccount);
router.put('/:id', bankAccountController.updateBankAccount);
router.delete('/:id', bankAccountController.deleteBankAccount);

// Status toggle
router.patch('/:id/toggle-status', bankAccountController.toggleAccountStatus);

// Transactions
router.post('/:id/deposit', bankAccountController.deposit);
router.post('/:id/withdraw', bankAccountController.withdraw);
router.post('/transfer', bankAccountController.transfer);

// Statistics
router.get('/:id/stats', bankAccountController.getAccountStats);

module.exports = router;
