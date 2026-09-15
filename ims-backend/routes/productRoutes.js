const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ALL_STAFF_ROLES: READ_ROLES, PRODUCT_ENTRY_ROLES: WRITE_ROLES } = require('../config/roles');

// GET all products
router.get('/', authenticateToken, authorizeRoles(READ_ROLES), productController.getAllProducts);

// GET products by category - ensure this comes before /:id
router.get('/category/:category', authenticateToken, authorizeRoles(READ_ROLES), productController.getByCategory);

// GET product by ID
router.get('/:id', authenticateToken, authorizeRoles(READ_ROLES), productController.getProductById);

// POST create new product
router.post('/', authenticateToken, authorizeRoles(WRITE_ROLES), productController.createProduct);

// PUT/update a product
router.put('/:id', authenticateToken, authorizeRoles(WRITE_ROLES), productController.updateProduct);

// DELETE a product
router.delete('/:id', authenticateToken, authorizeRoles(WRITE_ROLES), productController.deleteProduct);

module.exports = router;
