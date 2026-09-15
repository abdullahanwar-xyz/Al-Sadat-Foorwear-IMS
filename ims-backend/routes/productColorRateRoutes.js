const express = require('express');
const router = express.Router();
const productColorRateController = require('../controllers/productColorRateController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ALL_STAFF_ROLES: READ_ROLES, PRODUCT_ENTRY_ROLES: WRITE_ROLES } = require('../config/roles');

// Get all product color rates
router.get('/', authenticateToken, authorizeRoles(READ_ROLES), productColorRateController.getAllProductColorRates);

// Get color rates by product ID
router.get('/product/:productId', authenticateToken, authorizeRoles(READ_ROLES), productColorRateController.getByProductId);

// Get product color rate by ID
router.get('/:id', authenticateToken, authorizeRoles(READ_ROLES), productColorRateController.getProductColorRateById);

// Create a new product color rate
router.post('/', authenticateToken, authorizeRoles(WRITE_ROLES), productColorRateController.createProductColorRate);

// Update product color rate
router.put('/:id', authenticateToken, authorizeRoles(WRITE_ROLES), productColorRateController.updateProductColorRate);

// Delete product color rate
router.delete('/:id', authenticateToken, authorizeRoles(WRITE_ROLES), productColorRateController.deleteProductColorRate);

module.exports = router;
