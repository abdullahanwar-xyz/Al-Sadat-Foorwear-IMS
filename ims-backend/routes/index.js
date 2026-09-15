const express = require('express');
const router = express.Router();

const productRoutes = require('./productRoutes');
const productColorRateRoutes = require('./productColorRateRoutes');
const customerRoutes = require('./customerRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const invoiceItemRoutes = require('./invoiceItemRoutes');
const estimateRoutes = require('./estimateRoutes');
const paymentRoutes = require('./paymentRoutes');
const gatePassRoutes = require('./gatePassRoutes');
const returnAdjustmentRoutes = require('./returnAdjustmentRoutes');
const windowCalculatorRoutes = require('./windowCalculatorRoutes');
const windowSettingsRoutes = require('./windowSettingsRoutes');
const windowInvoiceRoutes = require('./windowInvoiceRoutes');
const windowInvoiceSettingsRoutes = require('./windowInvoiceSettingsRoutes');

// Mount all routes
router.use('/products', productRoutes);
router.use('/product-color-rates', productColorRateRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/invoice-items', invoiceItemRoutes);
router.use('/estimates', estimateRoutes);
router.use('/payments', paymentRoutes);
router.use('/gate-passes', gatePassRoutes);
router.use('/return-adjustments', returnAdjustmentRoutes);
router.use('/window-calculator', windowCalculatorRoutes);
router.use('/window-settings', windowSettingsRoutes);
router.use('/window-invoices', windowInvoiceRoutes);
router.use('/window-invoice-settings', windowInvoiceSettingsRoutes);

module.exports = router;
