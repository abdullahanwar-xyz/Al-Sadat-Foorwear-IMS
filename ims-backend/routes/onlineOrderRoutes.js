const express = require('express');
const router = express.Router();
const onlineOrderController = require('../controllers/onlineOrderController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES, ADMIN_ROLES } = require('../config/roles');

router.get('/', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.getAll);
router.get('/:id', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.getById);
router.post('/', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.create);
router.patch('/:id/ship', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.ship);
router.patch('/:id/deliver', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.deliver);
router.post('/:id/cancel', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.cancel);
router.post('/:id/confirm-stock-received', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.confirmStockReceived);
router.post('/:id/refund', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderController.refund);
router.delete('/:id', authenticateToken, authorizeRoles(ADMIN_ROLES), onlineOrderController.delete);

module.exports = router;
