const BaseController = require('./baseController');
const { generateDocumentNumber } = require('../utils/invoiceNumber');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ProductColorRate = require('../models/ProductColorRate');
const ProductSize = require('../models/ProductSize');
const Payment = require('../models/Payment');
const { deductExactStock, restoreExactStock, InsufficientStockError } = require('../utils/stockService');
const { recordPayment } = require('../utils/paymentService');

class SaleController extends BaseController {
  constructor() {
    super(Invoice);
  }

  // Create a sale (invoice) with immediate, exact-size stock deduction
  create = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();
    try {
      const { invoice, items, payment } = req.body;

      if (!invoice) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Invoice data is required' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Items must be a non-empty array' });
      }

      // Resolve productColorRateId for each item and compute derived values
      const resolvedItems = [];
      const resolutionErrors = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        let productColorRateId = item.productColorRateId || null;
        let productColorRate = null;

        if (productColorRateId) {
          productColorRate = await ProductColorRate.findByPk(productColorRateId, {
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
            transaction
          });
        } else if (item.productId && item.color) {
          productColorRate = await ProductColorRate.findOne({
            where: { productId: item.productId, color: item.color },
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
            transaction
          });
          if (productColorRate) {
            productColorRateId = productColorRate.id;
          }
        }

        if (!productColorRate) {
          resolutionErrors.push(
            `Product configuration not found for item ${i + 1} (productId ${item.productId || 'n/a'}, color ${item.color || 'n/a'})`
          );
          continue;
        }

        const quantity = parseFloat(item.quantity) || 0;
        const size = parseFloat(item.size) || 0;
        // Always the shop's own stored rate for this product/color, never
        // whatever the client sent - the UI never lets staff type a custom
        // rate here either, so there's no legitimate reason for the two to
        // differ. Trusting item.rate would let a modified request record a
        // sale at any price while still deducting real stock at the real
        // rate's implied value.
        const rate = parseFloat(productColorRate.rate) || 0;

        let discountPercentage = 0;
        if (typeof item.discount === 'string' && item.discount.includes('%')) {
          discountPercentage = parseFloat(item.discount.replace('%', '')) || 0;
        } else {
          discountPercentage = parseFloat(item.discount) || 0;
        }

        // grossValue/netValue are quantity x rate (not size x quantity x
        // rate - "size" is a shoe size, not a length). totalFeet is kept
        // only as a legacy column, not used for money math.
        const totalFeet = size * quantity;
        const total = quantity * rate;
        const grossValue = total;
        const discountAmount = (grossValue * discountPercentage) / 100;
        const netValue = grossValue - discountAmount;

        resolvedItems.push({
          productId: productColorRate.productId,
          productColorRateId,
          productName: productColorRate.product?.name || 'Unknown Product',
          itemName: item.itemName || '',
          type: item.type || '',
          color: productColorRate.color,
          size,
          quantity,
          rate,
          discount: discountPercentage,
          total,
          totalFeet,
          grossValue,
          netValue,
          order: i + 1
        });
      }

      if (resolutionErrors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ message: resolutionErrors.join('; ') });
      }

      // First pass: validate exact-size stock availability for every item, collecting all shortfalls
      const shortfalls = [];
      for (const item of resolvedItems) {
        const productSize = await ProductSize.findOne({
          where: { productColorRateId: item.productColorRateId, size: item.size },
          transaction
        });

        const availableQuantity = productSize ? productSize.quantity : 0;
        if (!productSize || availableQuantity < item.quantity) {
          shortfalls.push({
            productName: item.productName,
            color: item.color,
            size: item.size,
            requestedQuantity: item.quantity,
            availableQuantity
          });
        }
      }

      if (shortfalls.length > 0) {
        await transaction.rollback();
        const errorDetails = shortfalls.map(s =>
          `"${s.productName}" (Color: ${s.color}, Size: ${s.size}) - Requested: ${s.requestedQuantity}, Available: ${s.availableQuantity}`
        ).join('; ');
        return res.status(400).json({
          message: `Insufficient stock for the following products: ${errorDetails}`,
          outOfStockItems: shortfalls
        });
      }

      // Generate invoice number if not provided
      if (!invoice.invoiceNumber) {
        invoice.invoiceNumber = generateDocumentNumber('INV');
      }

      const createdInvoice = await this.model.create(
        { ...invoice, stockDeducted: true },
        { transaction }
      );

      const invoiceItemsToCreate = resolvedItems.map(item => ({
        invoiceId: createdInvoice.id,
        productId: item.productId,
        productColorRateId: item.productColorRateId,
        itemName: item.itemName,
        type: item.type,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        total: item.total,
        totalFeet: item.totalFeet,
        grossValue: item.grossValue,
        netValue: item.netValue,
        order: item.order
      }));

      await InvoiceItem.bulkCreate(invoiceItemsToCreate, { transaction });

      // Second pass: deduct exact stock for each item now that availability is confirmed
      for (const item of resolvedItems) {
        await deductExactStock(item.productColorRateId, item.size, item.quantity, transaction);
      }

      // A sale and its payment are one action, not two: recording the
      // payment inside this SAME transaction (instead of a second, separate
      // request after this one commits) makes the whole thing all-or-
      // nothing. If the payment fails for any reason - bad method, missing
      // bank account, a DB error - everything above rolls back too, so a
      // failed payment can never leave behind a deducted-stock invoice with
      // no payment recorded. payment is optional: omitting it still creates
      // an unpaid invoice exactly as before.
      if (payment && parseFloat(payment.amount) > 0) {
        await recordPayment({
          invoiceId: createdInvoice.id,
          amount: payment.amount,
          method: payment.method,
          bank_account_id: payment.bank_account_id,
          paymentDate: payment.paymentDate || invoice.date,
          userId: req.user?.user_id,
        }, transaction);
      }

      await transaction.commit();

      const completeInvoice = await this.model.findByPk(createdInvoice.id, {
        include: [
          { model: Customer, as: 'customer' },
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              { model: Product, as: 'product' },
              { model: ProductColorRate, as: 'productColorRate' }
            ]
          },
          { model: Payment, as: 'payments' }
        ],
        order: [
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC']
        ]
      });

      return res.status(201).json(completeInvoice);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof InsufficientStockError) {
        return res.status(400).json({ message: error.message, details: error.details });
      }
      if (error.message === 'Bank account is required for this payment method') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message === 'Bank account not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Cancel a sale: restore exact stock and soft-cancel the invoice
  cancel = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();
    try {
      const { id } = req.params;

      const invoice = await this.model.findByPk(id, {
        include: [{ model: InvoiceItem, as: 'items' }],
        transaction
      });

      if (!invoice) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Invoice not found' });
      }

      if (!invoice.stockDeducted) {
        await transaction.rollback();
        return res.status(400).json({ message: 'This invoice has no deducted stock to restore (not a Record Sale invoice, or already cancelled)' });
      }

      if (invoice.status === 'cancelled') {
        await transaction.rollback();
        return res.status(400).json({ message: 'This invoice is already cancelled' });
      }

      for (const item of invoice.items) {
        await restoreExactStock(item.productColorRateId, item.size, item.quantity, transaction);
      }

      await invoice.update({ status: 'cancelled', stockDeducted: false }, { transaction });

      await transaction.commit();

      const updatedInvoice = await this.model.findByPk(id, {
        include: [
          { model: Customer, as: 'customer' },
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              { model: Product, as: 'product' },
              { model: ProductColorRate, as: 'productColorRate' }
            ]
          }
        ]
      });

      return res.status(200).json(updatedInvoice);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof InsufficientStockError) {
        return res.status(400).json({ message: error.message, details: error.details });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new SaleController();
