const { generateDocumentNumber } = require('../utils/invoiceNumber');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ProductColorRate = require('../models/ProductColorRate');
const ProductSize = require('../models/ProductSize');
const Payment = require('../models/Payment');
const OnlineOrder = require('../models/OnlineOrder');
const Refund = require('../models/Refund');
const { deductExactStock, restoreExactStock, InsufficientStockError } = require('../utils/stockService');
const { recordPayment, recordRefund } = require('../utils/paymentService');
const invoiceController = require('./invoiceController');

// Fully separate from saleController: an Online Order is a real Invoice
// from the moment it's placed (same immediate-stock-deduction pattern as
// Record Sale), plus a companion OnlineOrder row carrying the channel,
// delivery details, and fulfillment lifecycle Record Sale never needs. This
// deliberately duplicates the relevant slice of saleController.create
// rather than branching inside it - Record Sale's own code path stays
// completely untouched by this feature.
class OnlineOrderController {
  includeForDetail() {
    return [
      { model: Customer, as: 'customer' },
      {
        model: InvoiceItem,
        as: 'items',
        include: [
          { model: Product, as: 'product' },
          { model: ProductColorRate, as: 'productColorRate' }
        ]
      },
      { model: Payment, as: 'payments' },
      { model: Refund, as: 'orderRefunds' },
      { model: OnlineOrder, as: 'onlineOrder' }
    ];
  }

  // Create an online order: same validate -> deduct-stock -> create-Invoice
  // +Items -> optional-advance-payment transaction saleController.create
  // uses, plus the OnlineOrder row and Invoice.source.
  create = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const { invoice, items, payment, source, deliveryAddress, deliveryCharge } = req.body;

      if (!invoice) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Invoice data is required' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Items must be a non-empty array' });
      }
      if (!source) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Order source is required' });
      }
      if (!deliveryAddress || !deliveryAddress.trim()) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Delivery address is required' });
      }

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
        const rate = parseFloat(productColorRate.rate) || 0;

        let discountPercentage = 0;
        if (typeof item.discount === 'string' && item.discount.includes('%')) {
          discountPercentage = parseFloat(item.discount.replace('%', '')) || 0;
        } else {
          discountPercentage = parseFloat(item.discount) || 0;
        }

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

      if (!invoice.invoiceNumber) {
        invoice.invoiceNumber = generateDocumentNumber('INV');
      }

      const createdInvoice = await Invoice.create(
        { ...invoice, stockDeducted: true, source },
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

      for (const item of resolvedItems) {
        await deductExactStock(item.productColorRateId, item.size, item.quantity, transaction);
      }

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

      await OnlineOrder.create({
        invoiceId: createdInvoice.id,
        source,
        deliveryAddress: deliveryAddress.trim(),
        deliveryCharge: deliveryCharge !== undefined && deliveryCharge !== null && deliveryCharge !== ''
          ? parseFloat(deliveryCharge)
          : 500,
        fulfillmentStatus: 'pending',
        createdBy: req.user?.user_id,
      }, { transaction });

      await transaction.commit();

      const completeInvoice = await Invoice.findByPk(createdInvoice.id, {
        include: this.includeForDetail(),
        order: [[{ model: InvoiceItem, as: 'items' }, 'order', 'ASC']]
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

  // List every invoice that has an OnlineOrder companion row - the mirror
  // image of invoiceController.getAll's exclusion filter.
  getAll = async (req, res) => {
    try {
      const invoices = await Invoice.findAll({
        include: [
          { model: OnlineOrder, as: 'onlineOrder', required: true },
          { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
          { model: Payment, as: 'payments' },
          { model: Refund, as: 'orderRefunds' },
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              { model: Product, as: 'product' },
              { model: ProductColorRate, as: 'productColorRate' }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(invoices);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  getById = async (req, res) => {
    try {
      const invoice = await Invoice.findOne({
        where: { id: req.params.id },
        include: [
          { model: OnlineOrder, as: 'onlineOrder', required: true },
          ...this.includeForDetail().filter(inc => inc.as !== 'onlineOrder')
        ]
      });
      if (!invoice) {
        return res.status(404).json({ message: 'Online order not found' });
      }
      return res.status(200).json(invoice);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Shared lookup for the action endpoints below - fetches the Invoice
  // together with its OnlineOrder row (404s if either is missing) inside
  // the caller's transaction.
  async loadOrder(id, transaction, extraInclude = []) {
    const invoice = await Invoice.findByPk(id, {
      include: [
        { model: OnlineOrder, as: 'onlineOrder', required: true },
        { model: InvoiceItem, as: 'items' },
        ...extraInclude
      ],
      transaction
    });
    return invoice;
  }

  ship = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const invoice = await this.loadOrder(req.params.id, transaction);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }
      if (invoice.onlineOrder.fulfillmentStatus !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({ message: `Cannot mark shipped from status "${invoice.onlineOrder.fulfillmentStatus}"` });
      }

      await invoice.onlineOrder.update({ fulfillmentStatus: 'shipped', shippedAt: new Date() }, { transaction });
      await transaction.commit();

      const updated = await Invoice.findByPk(req.params.id, { include: this.includeForDetail() });
      return res.status(200).json(updated);
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ message: error.message });
    }
  };

  deliver = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const { payment } = req.body || {};
      const invoice = await this.loadOrder(req.params.id, transaction);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }
      if (invoice.onlineOrder.fulfillmentStatus !== 'shipped') {
        await transaction.rollback();
        return res.status(400).json({ message: `Cannot mark delivered from status "${invoice.onlineOrder.fulfillmentStatus}"` });
      }

      if (payment && parseFloat(payment.amount) > 0) {
        await recordPayment({
          invoiceId: invoice.id,
          amount: payment.amount,
          method: payment.method,
          bank_account_id: payment.bank_account_id,
          paymentDate: payment.paymentDate || new Date(),
          userId: req.user?.user_id,
        }, transaction);
      }

      await invoice.onlineOrder.update({ fulfillmentStatus: 'delivered', deliveredAt: new Date() }, { transaction });
      await transaction.commit();

      const updated = await Invoice.findByPk(req.params.id, { include: this.includeForDetail() });
      return res.status(200).json(updated);
    } catch (error) {
      await transaction.rollback();
      if (error.message === 'Bank account is required for this payment method') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message === 'Bank account not found') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Cancel is allowed from Pending or Shipped. Stock is only auto-restored
  // when the order never left the shop (Pending) - a Shipped cancellation
  // (failed delivery) leaves stock deducted until Confirm Stock Received is
  // triggered separately, once staff have the parcel physically back.
  // Money is never touched here - refunding is always a separate, manual
  // "Issue Refund" action.
  cancel = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const { reason } = req.body || {};
      const invoice = await this.loadOrder(req.params.id, transaction);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }

      const currentStatus = invoice.onlineOrder.fulfillmentStatus;
      if (currentStatus !== 'pending' && currentStatus !== 'shipped') {
        await transaction.rollback();
        return res.status(400).json({ message: `Cannot cancel an order that is already "${currentStatus}"` });
      }

      const updates = {
        fulfillmentStatus: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      };

      if (currentStatus === 'pending') {
        // Never left the shop - safe to restore stock immediately and
        // automatically, no manual confirmation needed.
        for (const item of invoice.items) {
          await restoreExactStock(item.productColorRateId, item.size, item.quantity, transaction);
        }
        updates.stockReturnedAt = new Date();
      }
      // currentStatus === 'shipped': stock stays deducted; stockReturnedAt
      // is left null until confirmStockReceived is explicitly triggered.

      await invoice.update({ status: 'cancelled' }, { transaction });
      await invoice.onlineOrder.update(updates, { transaction });

      await transaction.commit();

      const updated = await Invoice.findByPk(req.params.id, { include: this.includeForDetail() });
      return res.status(200).json(updated);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof InsufficientStockError) {
        return res.status(400).json({ message: error.message, details: error.details });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Manual step for a post-shipment cancellation once the parcel is
  // physically back on the shelf - restores stock only now, never
  // automatically at cancel time.
  confirmStockReceived = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const invoice = await this.loadOrder(req.params.id, transaction);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }
      const order = invoice.onlineOrder;
      if (order.fulfillmentStatus !== 'cancelled') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Stock can only be confirmed received for a cancelled order' });
      }
      if (order.stockReturnedAt) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Stock has already been confirmed received for this order' });
      }

      for (const item of invoice.items) {
        await restoreExactStock(item.productColorRateId, item.size, item.quantity, transaction);
      }
      await order.update({ stockReturnedAt: new Date() }, { transaction });

      await transaction.commit();

      const updated = await Invoice.findByPk(req.params.id, { include: this.includeForDetail() });
      return res.status(200).json(updated);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof InsufficientStockError) {
        return res.status(400).json({ message: error.message, details: error.details });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Always staff-triggered, always explicit - never fired automatically by
  // cancel/confirmStockReceived above. The suggested amount is computed
  // client-side for the pre-fill; whatever amount is submitted here is what
  // actually moves.
  refund = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const { amount, method, bank_account_id } = req.body || {};
      const invoice = await this.loadOrder(req.params.id, transaction);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }
      const order = invoice.onlineOrder;
      if (order.fulfillmentStatus !== 'cancelled') {
        await transaction.rollback();
        return res.status(400).json({ message: 'A refund can only be issued for a cancelled order' });
      }
      if (order.refundedAt) {
        await transaction.rollback();
        return res.status(400).json({ message: 'This order has already been refunded' });
      }
      const refundAmount = parseFloat(amount);
      if (!refundAmount || refundAmount <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'A positive refund amount is required' });
      }
      if (!method) {
        await transaction.rollback();
        return res.status(400).json({ message: 'A refund method is required' });
      }

      await recordRefund({
        invoiceId: invoice.id,
        amount: refundAmount,
        method,
        bank_account_id,
        refundDate: new Date(),
        userId: req.user?.user_id,
        referenceLabel: `Refund for cancelled online order (Invoice ${invoice.invoiceNumber})`,
      }, transaction);

      await order.update({ refundAmount, refundedAt: new Date() }, { transaction });

      await transaction.commit();

      const updated = await Invoice.findByPk(req.params.id, { include: this.includeForDetail() });
      return res.status(200).json(updated);
    } catch (error) {
      await transaction.rollback();
      if (error.message === 'Bank account is required for this payment method') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message === 'Bank account not found') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Admin-only (see routes). No status blocks deletion - full undo of the
  // order regardless of where it is in its lifecycle:
  //  - Stock: restored only if not already accounted for
  //    (stockReturnedAt null covers Pending/Shipped/Delivered, where the
  //    item never came back, and a Cancelled order still awaiting
  //    Confirm Stock Received). Already-restored stock (pre-dispatch
  //    cancel, or a confirmed post-dispatch cancel) is left alone.
  //  - Money: every Payment reversed, every Refund reversed - reusing
  //    invoiceController's exact helpers, which don't care whether the
  //    refund was anchored via returnId or invoiceId.
  delete = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
      const invoice = await this.loadOrder(req.params.id, transaction, [
        // invoiceController.reversePayments reads payment.invoice.invoiceNumber
        // for its CashFlow description - without this nested include it falls
        // back to "Unknown", which is technically correct money-wise but
        // makes the ledger harder to read.
        { model: Payment, as: 'payments', include: [{ model: Invoice, as: 'invoice', attributes: ['invoiceNumber'] }] },
        { model: Refund, as: 'orderRefunds' },
      ]);
      if (!invoice || !invoice.onlineOrder) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Online order not found' });
      }
      const order = invoice.onlineOrder;

      if (!order.stockReturnedAt) {
        for (const item of invoice.items) {
          await restoreExactStock(item.productColorRateId, item.size, item.quantity, transaction);
        }
      }

      if (invoice.payments && invoice.payments.length > 0) {
        await invoiceController.reversePayments(invoice.payments, transaction);
      }
      if (invoice.orderRefunds && invoice.orderRefunds.length > 0) {
        await invoiceController.reverseRefunds(invoice.orderRefunds, invoice.invoiceNumber, transaction);
      }

      await Refund.destroy({ where: { invoiceId: invoice.id }, transaction });
      await Payment.destroy({ where: { invoiceId: invoice.id }, transaction });
      await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction });
      await order.destroy({ transaction });
      await invoice.destroy({ transaction });

      await transaction.commit();

      return res.status(200).json({
        message: 'Online order deleted. Stock and payments have been reversed where applicable.',
      });
    } catch (error) {
      await transaction.rollback();
      if (error instanceof InsufficientStockError) {
        return res.status(400).json({ message: error.message, details: error.details });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new OnlineOrderController();
