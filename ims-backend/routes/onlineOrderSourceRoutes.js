const express = require('express');
const router = express.Router();
const onlineOrderSourceController = require('../controllers/onlineOrderSourceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { SALESMAN_ROLES, ADMIN_ROLES } = require('../config/roles');

router.get('/', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderSourceController.getAll);
router.post('/', authenticateToken, authorizeRoles(SALESMAN_ROLES), onlineOrderSourceController.create);
router.delete('/:id', authenticateToken, authorizeRoles(ADMIN_ROLES), onlineOrderSourceController.delete);

module.exports = router;
