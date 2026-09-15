const { sequelize } = require('../config/db');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Product = require('../models/Product');
const ProductColorRate = require('../models/ProductColorRate');
const ProductSize = require('../models/ProductSize');
const Customer = require('../models/Customer');
const Return = require('../models/Return');
const ReturnItem = require('../models/ReturnItem');
const ExchangeItem = require('../models/ExchangeItem');
const Refund = require('../models/Refund');
const Payment = require('../models/Payment');
const { deductExactStock, restoreExactStock, InsufficientStockError } = require('../utils/stockService');
const { recordPayment, recordRefund } = require('../utils/paymentService');

const SETTLEMENT_EPSILON = 0.01;

// GET /api/returns/invoice/:invoiceId/summary
// Per invoice item: original quantity, already returned, and what's still
// returnable. This is what the Return/Exchange picker UI is built from.
// Items with nothing left to act on (fully returned or fully exchanged-out)
// are excluded entirely, not just marked unselectable - the picker should
// never be able to show them as an option in the first place.
exports.getSummary = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findByPk(invoiceId, {
      include: [
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

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const items = (invoice.items || [])
      .map(item => ({
        invoiceItemId: item.id,
        productId: item.productId,
        productColorRateId: item.productColorRateId,
        productName: item.product?.name || item.itemName,
        color: item.color,
        size: item.size,
        rate: item.rate,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity,
        returnableQuantity: item.quantity - item.returnedQuantity,
      }))
      .filter(item => item.returnableQuantity > 0);

    return res.status(200).json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      stockDeducted: invoice.stockDeducted,
      status: invoice.status,
      items
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/returns - list, used by the Dashboard to net today's refunds
// out of "Today's Sales".
exports.getAll = async (req, res) => {
  try {
    const records = await Return.findAll({
      include: [{ model: Refund, as: 'refunds' }],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/returns
// Body: { invoiceId, reason?, items: [{ invoiceItemId, returnedQuantity,
//           isExchange?, newProductColorRateId?, newSize?, newQuantity?, newRate? }],
//         settlement?: { method, bank_account_id? } }
//
// Single-invoice model: a Return or Exchange always acts on the SAME
// invoice, forever - the invoice's id/invoiceNumber never change no matter
// how many return/exchange events happen to it over its lifetime.
//
// A plain return marks the touched item's returnedQuantity up (removing it
// from "active" once it reaches quantity) and settles any refund against
// this invoice. An exchange does the same to the old item AND adds the new
// item as a brand-new InvoiceItem row on this same invoice - fully
// trackable for its own future returns/exchanges, exactly like any other
// line. There is no "carry forward untouched items" step at all: items not
// touched by this action simply stay exactly as they already are.
exports.create = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { invoiceId, reason, items, settlement } = req.body;
    const userId = req.user?.user_id || null;

    if (!invoiceId) {
      await transaction.rollback();
      return res.status(400).json({ message: 'invoiceId is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'items must be a non-empty array' });
    }

    // Each invoiceItemId may appear at most once - the whole validate/act
    // pipeline below re-reads the same InvoiceItem row independently for
    // every entry, so two entries for the same id would each validate
    // against the same stale returnedQuantity and then race to overwrite
    // (not accumulate) each other's update. The UI already enforces this
    // (one row per invoiceItemId), so this only guards against a malformed
    // direct API call.
    const seenInvoiceItemIds = new Set();
    for (const reqItem of items) {
      if (seenInvoiceItemIds.has(reqItem.invoiceItemId)) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Invoice item ${reqItem.invoiceItemId} appears more than once in this request - combine it into a single line`
        });
      }
      seenInvoiceItemIds.add(reqItem.invoiceItemId);
    }

    const invoice = await Invoice.findByPk(invoiceId, { transaction });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }
    if (!invoice.stockDeducted) {
      await transaction.rollback();
      return res.status(400).json({ message: 'This invoice has no deducted stock to return against' });
    }
    if (invoice.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Cannot process a return on a cancelled invoice' });
    }

    // First pass: validate and lock every requested item before touching
    // anything, mirroring saleController's validate-then-act pattern. This
    // is also what makes over-returning across concurrent requests impossible -
    // the row lock is held until commit/rollback.
    const resolved = [];
    const errors = [];

    for (const reqItem of items) {
      const invoiceItem = await InvoiceItem.findOne({
        where: { id: reqItem.invoiceItemId, invoiceId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!invoiceItem) {
        errors.push(`Invoice item ${reqItem.invoiceItemId} not found on this invoice`);
        continue;
      }

      const returnedQuantity = parseFloat(reqItem.returnedQuantity) || 0;
      if (returnedQuantity <= 0) {
        errors.push(`Return quantity for "${invoiceItem.itemName}" must be greater than 0`);
        continue;
      }

      const remaining = invoiceItem.quantity - invoiceItem.returnedQuantity;
      if (returnedQuantity > remaining) {
        errors.push(
          `Only ${remaining} of "${invoiceItem.itemName}" (size ${invoiceItem.size}) remain returnable, requested ${returnedQuantity}`
        );
        continue;
      }

      const isExchange = !!reqItem.isExchange;

      if (!isExchange) {
        resolved.push({ invoiceItem, returnedQuantity, isExchange: false });
        continue;
      }

      if (!Array.isArray(reqItem.newItems) || reqItem.newItems.length === 0) {
        errors.push(`Exchange for "${invoiceItem.itemName}" needs at least one new item`);
        continue;
      }

      // One returned item can be exchanged for several different new items -
      // validate each new line independently (exact product+color+size match
      // only, same rule as everywhere else stock moves).
      const resolvedNewItems = [];
      let anyNewItemInvalid = false;

      for (const newItemReq of reqItem.newItems) {
        const newSize = parseFloat(newItemReq.newSize);
        const newQuantity = parseFloat(newItemReq.newQuantity) || 0;

        if (!newItemReq.newProductColorRateId || Number.isNaN(newSize) || newQuantity <= 0) {
          errors.push(`Exchange item for "${invoiceItem.itemName}" is missing a valid new product/size/quantity`);
          anyNewItemInvalid = true;
          continue;
        }

        const newProductColorRate = await ProductColorRate.findByPk(newItemReq.newProductColorRateId, {
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
          transaction
        });

        if (!newProductColorRate) {
          errors.push('Selected exchange product/color not found');
          anyNewItemInvalid = true;
          continue;
        }

        const newProductSize = await ProductSize.findOne({
          where: { productColorRateId: newItemReq.newProductColorRateId, size: newSize },
          transaction
        });

        const availableQuantity = newProductSize ? newProductSize.quantity : 0;
        if (!newProductSize || availableQuantity < newQuantity) {
          errors.push(
            `"${newProductColorRate.product?.name || 'Item'}" (Color: ${newProductColorRate.color}, Size: ${newSize}) - requested ${newQuantity}, available ${availableQuantity}`
          );
          anyNewItemInvalid = true;
          continue;
        }

        resolvedNewItems.push({
          newProductId: newProductColorRate.productId,
          newProductColorRateId: newItemReq.newProductColorRateId,
          newColor: newProductColorRate.color,
          newSize,
          newQuantity,
          // Always the shop's own stored rate, never newItemReq.newRate -
          // the picker never lets staff type a custom rate either, and the
          // old `|| newProductColorRate.rate` fallback only guarded a
          // missing/zero value, not a manipulated non-zero one.
          newRate: parseFloat(newProductColorRate.rate) || 0,
          newItemName: newProductColorRate.product?.name || '',
        });
      }

      if (anyNewItemInvalid) continue;

      resolved.push({
        invoiceItem,
        returnedQuantity,
        isExchange: true,
        newItems: resolvedNewItems,
      });
    }

    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ message: errors.join('; ') });
    }

    const hasExchange = resolved.some(r => r.isExchange);
    const createdReturn = await Return.create({
      invoiceId,
      type: hasExchange ? 'exchange' : 'return',
      processedByUserId: userId,
      reason: reason || null,
      date: new Date().toISOString().split('T')[0]
    }, { transaction });

    let netDifference = 0; // negative = refund owed to customer, positive = extra payment owed by customer

    // New exchange lines get appended after whatever's already on the
    // invoice, in the order events happen - fetched once up front so
    // multiple exchange rows in the same batch don't collide.
    let nextOrder = (await InvoiceItem.max('order', { where: { invoiceId }, transaction })) || 0;

    for (const r of resolved) {
      const refundRate = r.invoiceItem.rate;
      const refundAmount = r.returnedQuantity * refundRate;
      const totalNewValue = r.isExchange
        ? r.newItems.reduce((sum, ni) => sum + ni.newQuantity * ni.newRate, 0)
        : 0;
      const priceDifference = r.isExchange ? totalNewValue - refundAmount : -refundAmount;

      const returnItem = await ReturnItem.create({
        returnId: createdReturn.id,
        invoiceItemId: r.invoiceItem.id,
        returnedQuantity: r.returnedQuantity,
        refundRate,
        refundAmount,
        isExchange: r.isExchange,
        priceDifference,
      }, { transaction });

      await r.invoiceItem.update(
        { returnedQuantity: r.invoiceItem.returnedQuantity + r.returnedQuantity },
        { transaction }
      );

      // Restore stock for the exact original product/color/size.
      await restoreExactStock(r.invoiceItem.productColorRateId, r.invoiceItem.size, r.returnedQuantity, transaction);

      if (r.isExchange) {
        // Exchange: one returned item can be swapped for several different
        // new items - deduct each one's stock (already validated above -
        // exact-match, no-fallback, same as Record Sale) and add each as its
        // own brand-new line on this SAME invoice - not a new invoice. Every
        // new line is a completely normal InvoiceItem row from here on,
        // independently returnable/exchangeable in its own right.
        for (const ni of r.newItems) {
          await deductExactStock(ni.newProductColorRateId, ni.newSize, ni.newQuantity, transaction);

          nextOrder += 1;
          const total = ni.newQuantity * ni.newRate;
          const newInvoiceItem = await InvoiceItem.create({
            invoiceId,
            productId: ni.newProductId,
            productColorRateId: ni.newProductColorRateId,
            itemName: ni.newItemName,
            type: '',
            color: ni.newColor,
            size: ni.newSize,
            quantity: ni.newQuantity,
            rate: ni.newRate,
            discount: 0,
            total,
            totalFeet: ni.newSize,
            grossValue: total,
            netValue: total,
            order: nextOrder,
          }, { transaction });

          await ExchangeItem.create({
            returnItemId: returnItem.id,
            productColorRateId: ni.newProductColorRateId,
            size: ni.newSize,
            quantity: ni.newQuantity,
            rate: ni.newRate,
            newInvoiceItemId: newInvoiceItem.id,
          }, { transaction });
        }
      }

      netDifference += priceDifference;
    }

    let paymentRecord = null;
    let refundRecord = null;

    if (netDifference > SETTLEMENT_EPSILON) {
      if (!settlement || !settlement.method) {
        await transaction.rollback();
        return res.status(400).json({ message: 'A settlement method is required: the customer owes an additional payment' });
      }
      const result = await recordPayment({
        invoiceId,
        amount: Math.round(netDifference * 100) / 100,
        method: settlement.method,
        bank_account_id: settlement.bank_account_id,
        paymentDate: new Date(),
        userId,
        returnId: createdReturn.id,
        referenceLabel: `Exchange top-up for Return #${createdReturn.id} (Invoice ${invoice.invoiceNumber})`,
        // This invoice's original payment lifecycle (status/remainingAmount)
        // was already closed out at sale time - a later settlement payment
        // for a return/exchange tops it up without reopening that.
        skipStatusRecalc: true,
      }, transaction);
      paymentRecord = result.payment;
    } else if (netDifference < -SETTLEMENT_EPSILON) {
      if (!settlement || !settlement.method) {
        await transaction.rollback();
        return res.status(400).json({ message: 'A refund method is required' });
      }
      const result = await recordRefund({
        returnId: createdReturn.id,
        amount: Math.round(-netDifference * 100) / 100,
        method: settlement.method,
        bank_account_id: settlement.bank_account_id,
        refundDate: new Date(),
        userId,
        referenceLabel: `Refund for Return #${createdReturn.id} (Invoice ${invoice.invoiceNumber})`
      }, transaction);
      refundRecord = result.refund;
    }

    await transaction.commit();

    const fullReturn = await Return.findByPk(createdReturn.id, {
      include: [
        { model: ReturnItem, as: 'items', include: [{ model: ExchangeItem, as: 'exchangeItems' }] },
        { model: Refund, as: 'refunds' },
      ]
    });

    // The same invoice, fully refreshed - Items/History/Amount Summary are
    // all derived from this on the frontend, so the caller (which just
    // acted on this exact invoice) gets its new state back in one response
    // instead of needing a separate follow-up fetch before it can print.
    const updatedInvoice = await Invoice.findByPk(invoiceId, {
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
        { model: Payment, as: 'payments' },
        {
          model: Return,
          as: 'returns',
          include: [
            { model: ReturnItem, as: 'items', include: [{ model: ExchangeItem, as: 'exchangeItems' }] },
            { model: Refund, as: 'refunds' }
          ]
        }
      ],
      order: [
        [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC']
      ]
    });

    return res.status(201).json({
      return: fullReturn,
      payment: paymentRecord,
      refund: refundRecord,
      invoice: updatedInvoice,
      netDifference
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof InsufficientStockError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/returns/:id
exports.getById = async (req, res) => {
  try {
    const record = await Return.findByPk(req.params.id, {
      include: [
        { model: ReturnItem, as: 'items', include: [{ model: ExchangeItem, as: 'exchangeItems' }] },
        { model: Refund, as: 'refunds' },
        {
          model: Invoice,
          as: 'invoice',
          include: [{ model: Customer, as: 'customer' }]
        }
      ]
    });

    if (!record) {
      return res.status(404).json({ message: 'Return not found' });
    }

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
