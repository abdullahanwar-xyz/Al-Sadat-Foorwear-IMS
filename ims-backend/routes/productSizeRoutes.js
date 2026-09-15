const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ALL_STAFF_ROLES: READ_ROLES } = require('../config/roles');

// GET item details (product name, collection, color, size, quantity) for a
// scanned QR/barcode. The code just encodes the ProductSize id.
router.get('/lookup/:id', authenticateToken, authorizeRoles(READ_ROLES), productController.lookupProductSize);

module.exports = router;
