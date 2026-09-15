const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimit');
const { ADMIN_ROLES } = require('../config/roles');

// Public routes (no authentication required)
router.post('/login', loginRateLimiter, userController.login);

// Protected routes (require authentication)
router.get('/', authenticateToken, userController.getAll);
router.get('/:id([0-9]+)', authenticateToken, userController.getById);

// Role-restricted routes (only ShopOwner or SuperAdmin)
router.post('/register', authenticateToken, authorizeRoles(ADMIN_ROLES), userController.register);
router.put('/:id([0-9]+)', authenticateToken, authorizeRoles(ADMIN_ROLES), userController.update);
router.delete('/:id([0-9]+)', authenticateToken, authorizeRoles(ADMIN_ROLES), userController.delete);
router.delete('/:id([0-9]+)/permanent', authenticateToken, authorizeRoles(ADMIN_ROLES), userController.permanentDelete);
router.post('/:id([0-9]+)/reset-password', authenticateToken, authorizeRoles(ADMIN_ROLES), userController.resetUserPassword);

module.exports = router;
