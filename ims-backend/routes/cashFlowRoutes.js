const express = require('express');
const router = express.Router();
const cashFlowController = require('../controllers/cashFlowController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

// Query routes
router.get('/', cashFlowController.getAllCashFlows);
router.get('/summary', cashFlowController.getCashFlowSummary);
router.get('/:id', cashFlowController.getCashFlowById);

// Delete route (admin only)
router.delete('/:id', cashFlowController.deleteCashFlow);

module.exports = router;
