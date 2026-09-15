const express = require('express');
const router = express.Router();
const { uploadMiddleware, uploadProductColorImage } = require('../controllers/uploadController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { PRODUCT_ENTRY_ROLES: WRITE_ROLES } = require('../config/roles');

// POST a product color rate image
router.post('/product-color-image', authenticateToken, authorizeRoles(WRITE_ROLES), (req, res) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Image upload failed' });
    }
    return uploadProductColorImage(req, res);
  });
});

module.exports = router;
