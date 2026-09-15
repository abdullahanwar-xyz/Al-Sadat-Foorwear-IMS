const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// Public route - get all active payment methods
router.get('/', paymentMethodController.getAll.bind(paymentMethodController));

// Admin routes - require authentication and admin role
router.post('/',
  authenticateToken,
  authorizeRoles(ADMIN_ROLES),
  paymentMethodController.create.bind(paymentMethodController)
);

router.put('/:id',
  authenticateToken,
  authorizeRoles(ADMIN_ROLES),
  paymentMethodController.update.bind(paymentMethodController)
);

router.delete('/:id',
  authenticateToken,
  authorizeRoles(ADMIN_ROLES),
  paymentMethodController.delete.bind(paymentMethodController)
);

router.patch('/:id/toggle-status',
  authenticateToken,
  authorizeRoles(ADMIN_ROLES),
  paymentMethodController.toggleStatus.bind(paymentMethodController)
);

module.exports = router;
