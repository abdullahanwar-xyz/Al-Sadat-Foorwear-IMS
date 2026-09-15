const BaseController = require('./baseController');
const { generateDocumentNumber } = require('../utils/invoiceNumber');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Return = require('../models/Return');
const ReturnItem = require('../models/ReturnItem');
const Refund = require('../models/Refund');
const ExchangeItem = require('../models/ExchangeItem');
const ProductColorRate = require('../models/ProductColorRate');
const ProductSize = require('../models/ProductSize');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const OnlineOrder = require('../models/OnlineOrder');
const { sequelize } = require('../config/db');
const { restoreExactStock } = require('../utils/stockService');

class InvoiceController extends BaseController {
  constructor() {
    super(Invoice);
  }

  // Helper method to reverse payments and update bank account balances
  reversePayments = async (payments, transaction) => {
    try {
      for (const payment of payments) {
        if (!payment.bank_account_id) continue;

        // Find the bank account
        const bankAccount = await BankAccount.findByPk(payment.bank_account_id, { transaction });
        
        if (!bankAccount) {
          console.warn(`Bank account ${payment.bank_account_id} not found for payment reversal`);
          continue;
        }

        const balanceBefore = parseFloat(bankAccount.current_balance);
        const newBalance = balanceBefore - parseFloat(payment.amount);

        // Update bank account balance (deduct the payment amount)
        await bankAccount.update(
          { current_balance: newBalance },
          { transaction }
        );

        // Create a reversal cash flow entry
        await CashFlow.create({
          account_id: payment.bank_account_id,
          transaction_type: 'withdrawal',
          amount: parseFloat(payment.amount),
          payment_method: payment.method,
          description: `Payment reversal for deleted Invoice #${payment.invoice?.invoiceNumber || 'Unknown'}`,
          reference_type: 'invoice',
          reference_id: payment.invoiceId,
          transaction_date: new Date(),
          balance_before: balanceBefore,
          balance_after: newBalance
        }, { transaction });
      }
    } catch (error) {
      console.error('Error reversing payments:', error.message);
      throw new Error(`Payment reversal failed: ${error.message}`);
    }
  };

  // Helper method to reverse refunds and update bank account balances.
  // Mirrors reversePayments, but in the opposite direction: a Refund
  // originally deducted money from the account (it left the shop to the
  // customer), so erasing that refund means adding it back.
  reverseRefunds = async (refunds, invoiceNumber, transaction) => {
    try {
      for (const refund of refunds) {
        if (!refund.bank_account_id) continue;

        const bankAccount = await BankAccount.findByPk(refund.bank_account_id, { transaction });

        if (!bankAccount) {
          console.warn(`Bank account ${refund.bank_account_id} not found for refund reversal`);
          continue;
        }

        const balanceBefore = parseFloat(bankAccount.current_balance);
        const newBalance = balanceBefore + parseFloat(refund.amount);

        await bankAccount.update(
          { current_balance: newBalance },
          { transaction }
        );

        await CashFlow.create({
          account_id: refund.bank_account_id,
          transaction_type: 'deposit',
          amount: parseFloat(refund.amount),
          payment_method: refund.method,
          description: `Refund reversal for deleted Invoice #${invoiceNumber || 'Unknown'}`,
          reference_type: 'invoice',
          reference_id: null,
          transaction_date: new Date(),
          balance_before: balanceBefore,
          balance_after: newBalance
        }, { transaction });
      }
    } catch (error) {
      console.error('Error reversing refunds:', error.message);
      throw new Error(`Refund reversal failed: ${error.message}`);
    }
  };

  // Override getAll to include related data
  getAll = async (req, res) => {
    try {
      const invoices = await this.model.findAll({
        // Online Order invoices live in their own dedicated section, not
        // here - excluded via a left join that only keeps rows with no
        // matching OnlineOrder.
        where: { '$onlineOrder.id$': null },
        include: [
          { model: OnlineOrder, as: 'onlineOrder', attributes: [] },
          { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
          // returnId is needed so the Amount Summary can tell an exchange
          // top-up payment apart from the invoice's original sale payment.
          { model: Payment, as: 'payments', attributes: ['id', 'amount', 'method', 'returnId', 'paymentDate'] },
          { 
            model: InvoiceItem, 
            as: 'items', 
            include: [
              { model: Product, as: 'product' },
              { model: ProductColorRate, as: 'productColorRate' }
            ]
          },
          // Return/Exchange history against this invoice - drives the
          // Items/History/Amount Summary breakdown on the invoice detail
          // and print views. Every return/exchange event ever performed on
          // this invoice lives here, in the single-invoice model.
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
          ['createdAt', 'DESC'],
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
        ]
      });

      // Ensure all invoices have invoice numbers
      const processedInvoices = invoices.map(invoice => {
        const plainInvoice = invoice.get({ plain: true });
        if (!plainInvoice.invoiceNumber) {
          plainInvoice.invoiceNumber = `INV-${new Date().getFullYear()}-${invoice.id}`;
        }
        return plainInvoice;
      });
      
      return res.status(200).json(processedInvoices);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Override getById to include invoice items and customer
  getById = async (req, res) => {
    try {
      const invoice = await this.model.findByPk(req.params.id, {
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
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
        ]
      });
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      return res.status(200).json(invoice);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Create a new invoice
  create = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();
    try {
      // Check if customer exists
      // const customer = await Customer.findByPk(req.body.customerId);
      // if (!customer) {
      //   await transaction.rollback();
      //   return res.status(404).json({ message: 'Customer not found' });
      // }

      // Generate invoice number if not provided
      if (!req.body.invoiceNumber) {
        req.body.invoiceNumber = generateDocumentNumber('INV');
      }

      // Create the invoice
      const invoice = await this.model.create(req.body, { transaction });
      
      await transaction.commit();
      console.log('Invoice created successfully:', invoice);
      // Return the complete invoice
      const completeInvoice = await this.model.findByPk(invoice.id, {
        include: [
          { model: Customer, as: 'customer' }
        ]
      });
      
      return res.status(201).json(completeInvoice);
    } catch (error) {
      await transaction.rollback();
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Create invoice with items
  createWithItems = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();
    try {
      const { invoice, items } = req.body;
      
      // Check if customer exists
      if (invoice.customerId) {
        const customer = await Customer.findByPk(invoice.customerId);
        if (!customer) {
          await transaction.rollback();
          return res.status(404).json({ message: 'Customer not found' });
        }
      }
      
      // Generate invoice number if not provided
      if (!invoice.invoiceNumber) {
        invoice.invoiceNumber = generateDocumentNumber('INV');
      }
      
      // Validate required fields
      if (!invoice.date) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Invoice date is required' });
      }
      
      // Convert numeric values to ensure proper format
      invoice.grossAmount = parseFloat(invoice.grossAmount) || 0;
      invoice.discount = parseFloat(invoice.discount) || 0;
      invoice.taxAmount = parseFloat(invoice.taxAmount) || 0;
      invoice.netAmount = parseFloat(invoice.netAmount) || 0;
      
      try {
        // Create invoice
        const createdInvoice = await this.model.create(invoice, { transaction });
        
        // Create invoice items
        if (items && items.length) {
          // Validate and process each item sequentially to maintain order
          const processedItems = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Ensure all numeric values are properly formatted
            const quantity = parseFloat(item.quantity) || 0;
            const size = parseFloat(item.size) || 0;
            const rate = parseFloat(item.rate) || 0;
            
            // Handle discount - extract percentage value
            let discountPercentage = 0;
            if (typeof item.discount === 'string' && item.discount.includes('%')) {
              discountPercentage = parseFloat(item.discount.replace('%', '')) || 0;
            } else {
              discountPercentage = parseFloat(item.discount) || 0;
            }
            
            // Calculate derived values. grossValue/netValue are quantity x rate
            // (not size x quantity x rate — "size" is a shoe size, not a length).
            // totalFeet is kept only because force-delete's legacy stock
            // restoration still reads it; it's not used for money math.
            const totalFeet = size * quantity;
            const total = quantity * rate;
            const grossValue = total;
            const discountAmount = (grossValue * discountPercentage) / 100;
            const netValue = grossValue - discountAmount;

            // Find the productColorRateId based on the product and color
            let productColorRateId = null;
            if (item.productId && item.color) {
              try {
                let colorRateResult = await ProductColorRate.findOne({
                  where: {
                    productId: item.productId,
                    color: item.color
                  },
                  transaction
                });
                
                if (colorRateResult) {
                  productColorRateId = colorRateResult.id;
                }
              } catch (err) {
                // fallback: try to find any rate for this product
                const fallbackRate = await ProductColorRate.findOne({
                  where: { productId: item.productId },
                  transaction
                });
                if (fallbackRate) {
                  productColorRateId = fallbackRate.id;
                }
              }
            }

            // Use a default productColorRateId if none found
            if (!productColorRateId) {
              productColorRateId = 1; // or throw an error if strict validation is needed
            }

            const processedItem = {
              invoiceId: createdInvoice.id,
              productId: parseInt(item.productId) || 0,
              productColorRateId: productColorRateId,
              itemName: item.itemName || '',
              type: item.type || '',
              color: item.color || '',
              size: size,
              quantity: quantity,
              rate: rate,
              discount: discountPercentage, // Save percentage value, not amount
              total: total, // Add the total field
              totalFeet: totalFeet,
              grossValue: grossValue,
              netValue: netValue,
              order: i + 1 // Add order to preserve sequence (1-based)
            };
            processedItems.push(processedItem);
          }          
          try {
            await InvoiceItem.bulkCreate(processedItems, { transaction });
          } catch (itemError) {
            console.error('Error creating invoice items:', itemError);
            throw itemError;
          }
        }
        
        await transaction.commit();
        
        // Return the complete invoice with items
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
            }
          ],
          order: [
            [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
          ]
        });
        
        return res.status(201).json(completeInvoice);
      } catch (innerError) {
        // Handle specific model validation errors
        console.error('Error during invoice creation:', innerError);
        throw innerError;
      }
    } catch (error) {
      await transaction.rollback();
      console.error('Invoice creation failed:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          message: 'Validation error', 
          details: error.errors.map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
          }))
        });
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          message: 'Unique constraint error',
          details: error.errors.map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
          }))
        });
      }
      
      return res.status(500).json({ 
        message: error.message || 'An error occurred while creating the invoice',
        errorType: error.name
      });
    }
  };

  // Update an invoice
  update = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();
    try {
      const { id } = req.params;
      const { invoice, items } = req.body;
      
      // Check if invoice exists
      const existingInvoice = await this.model.findByPk(id, {
        include: [
          { 
            model: InvoiceItem, 
            as: 'items',
            include: [{ model: ProductColorRate, as: 'productColorRate' }]
          }
        ],
        transaction
      });
      
      if (!existingInvoice) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Invoice not found' });
      }

      if (existingInvoice.stockDeducted && items) {
        await transaction.rollback();
        return res.status(400).json({ message: 'This is a Record Sale invoice with stock already deducted; cancel it and create a new sale instead of editing its items' });
      }

      // Create a map of existing stock usage by productColorRateId and size for comparison
      const existingStockUsage = new Map();
      if (existingInvoice.items && existingInvoice.items.length) {
        for (const existingItem of existingInvoice.items) {
          if (existingItem.productColorRateId && existingItem.quantity && existingItem.size) {
            // Track actual pieces needed for each size, not total feet
            const key = `${existingItem.productColorRateId}_${existingItem.size}`;
            const piecesUsed = existingItem.quantity; // Direct pieces count
            existingStockUsage.set(key, (existingStockUsage.get(key) || 0) + piecesUsed);
          }
        }
      }
      
      // Update invoice
      await existingInvoice.update(invoice, { transaction });
      
      // Delete existing items
      await InvoiceItem.destroy({
        where: { invoiceId: id },
        transaction
      });
      
      // Process new items and calculate stock differences
      const newStockUsage = new Map();
      
      // If items are provided, create new ones and calculate stock changes
      if (items && items.length) {
        const processedItems = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          // Ensure all numeric values are properly formatted
          const quantity = parseFloat(item.quantity) || 0;
          const size = parseFloat(item.size) || 0;
          const rate = parseFloat(item.rate) || 0;
          
          // Handle discount - extract percentage value
          let discountPercentage = 0;
          if (typeof item.discount === 'string' && item.discount.includes('%') ) {
            discountPercentage = parseFloat(item.discount.replace('%', '')) || 0;
          } else {
            discountPercentage = parseFloat(item.discount) || 0;
          }
          
          // Calculate derived values. grossValue/netValue are quantity x rate
          // (not size x quantity x rate — "size" is a shoe size, not a length).
          // totalFeet is kept only because force-delete's legacy stock
          // restoration still reads it; it's not used for money math.
          const totalFeet = size * quantity;
          const total = quantity * rate;
          const grossValue = total;
          const discountAmount = (grossValue * discountPercentage) / 100;
          const netValue = grossValue - discountAmount;

          const processedItem = {
            invoiceId: id,
            productId: parseInt(item.productId) || 0,
            productColorRateId: 1, // Default value, will update below
            itemName: item.itemName || '',
            type: item.type || '',
            color: item.color || '',
            size: size,
            quantity: quantity,
            rate: rate,
            discount: discountPercentage, // Save percentage value, not amount
            total: total,
            totalFeet: totalFeet,
            grossValue: grossValue,
            netValue: netValue,
            order: i + 1 // Add order to preserve sequence (1-based)
          };
          
          // Find the productColorRateId and track new stock usage
          if (item.productId && item.color) {
            try {
              const colorRateResult = await ProductColorRate.findOne({
                where: {
                  productId: item.productId,
                  color: item.color
                },
                transaction
              });
              
              if (colorRateResult) {
                processedItem.productColorRateId = colorRateResult.id;
                
                // Track new stock usage for this productColorRateId and size
                const key = `${colorRateResult.id}_${size}`;
                newStockUsage.set(key, (newStockUsage.get(key) || 0) + quantity);
              }
            } catch (err) {
              console.error('Error finding productColorRateId for update:', err);
            }
          }
          
          processedItems.push(processedItem);
        }
        await InvoiceItem.bulkCreate(processedItems, { transaction });
      } else {
        // No items provided, restore all existing stock
        for (const [key, oldUsage] of existingStockUsage) {
          const [productColorRateId, size] = key.split('_').map(Number);
          await restoreExactStock(productColorRateId, size, oldUsage, transaction);
        }
      }
      
      await transaction.commit();
      
      // Return the updated invoice with items
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
        ],
        order: [
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
        ]
      });

      return res.status(200).json(updatedInvoice);
    } catch (error) {
      await transaction.rollback();
      console.error('Invoice update failed:', error);
      return res.status(500).json({ 
        message: error.message || 'An error occurred while updating the invoice'
      });
    }
  };

  // Update invoice status
  updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const [updated] = await this.model.update(
        { status },
        { where: { id } }
      );
      
      if (!updated) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      const invoice = await this.model.findByPk(id);
      return res.status(200).json(invoice);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Get invoices by customer id
  getByCustomerId = async (req, res) => {
    try {
      const invoices = await this.model.findAll({
        where: { customerId: req.params.customerId },
        include: [
          { model: Customer, as: 'customer' },
          { model: InvoiceItem, as: 'items', include: [Product] }
        ],
        order: [
          ['createdAt', 'DESC'],
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
        ]
      });
      return res.status(200).json(invoices);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Get invoices by date range
  getByDateRange = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const invoices = await this.model.findAll({
        where: {
          date: {
            [this.model.sequelize.Op.between]: [startDate, endDate]
          }
        },
        include: [
          { model: Customer, as: 'customer' },
          { model: InvoiceItem, as: 'items', include: [Product] }
        ],
        order: [
          ['date', 'DESC'],
          [{ model: InvoiceItem, as: 'items' }, 'order', 'ASC'] // Order items by order field
        ]
      });
      
      return res.status(200).json(invoices);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  delete = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { force } = req.query;

      const invoice = await this.model.findByPk(id, {
        include: [
          { model: InvoiceItem, as: 'items' },
          {
            model: Payment,
            as: 'payments',
            include: [{ model: Invoice, as: 'invoice', attributes: ['invoiceNumber'] }]
          },
          { model: Return, as: 'returns', include: [{ model: Refund, as: 'refunds' }] }
        ],
        transaction
      });

      if (!invoice) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Invoice not found' });
      }

      if (force === 'true') {
        // Force delete: Remove all related records first and reverse payments

        // Reverse all payments (update bank accounts and create cash flow entries)
        if (invoice.payments && invoice.payments.length > 0) {
          await this.reversePayments(invoice.payments, transaction);
        }

        // Reverse all refunds tied to Return/Exchange actions against this
        // invoice, then delete the Return/ReturnItem/Refund records
        // themselves - otherwise they're left as orphans pointing at an
        // invoiceId that no longer exists, which is exactly what was
        // making Dashboard's "Today's Sales" go negative: it nets today's
        // refunds against today's sales, and an orphaned Refund row still
        // counts even after its invoice (and the sale it refunded) is gone.
        const allRefunds = (invoice.returns || []).flatMap(r => r.refunds || []);
        if (allRefunds.length > 0) {
          await this.reverseRefunds(allRefunds, invoice.invoiceNumber, transaction);
        }
        const returnIds = (invoice.returns || []).map(r => r.id);
        if (returnIds.length > 0) {
          await Refund.destroy({ where: { returnId: returnIds }, transaction });
          await ReturnItem.destroy({ where: { returnId: returnIds }, transaction });
          await Return.destroy({ where: { id: returnIds }, transaction });
        }

        // Delete all payments related to this invoice
        await Payment.destroy({
          where: { invoiceId: id },
          transaction
        });

        // Restore stock for all invoice items before deletion - exact
        // product/color/size match only, same rule stockService.js uses
        // everywhere else stock moves. Only the still-outstanding quantity
        // needs restoring: any returned quantity was already put back by
        // the return itself (see returnController.js), so restoring the
        // item's full original quantity here would double-count it.
        for (const item of invoice.items) {
          const outstandingQuantity = item.quantity - (item.returnedQuantity || 0);
          if (outstandingQuantity > 0) {
            await restoreExactStock(item.productColorRateId, item.size, outstandingQuantity, transaction);
          }
        }

        // Delete all invoice items
        await InvoiceItem.destroy({
          where: { invoiceId: id },
          transaction
        });

        // Delete the invoice
        await this.model.destroy({
          where: { id },
          transaction
        });

        await transaction.commit();
        return res.status(200).json({ 
          message: 'Invoice and all related records deleted successfully. Payments have been reversed and account balances updated.' 
        });
      } else {
        // Normal delete: Check for blocking related records

        // If there are Return/Exchange records (and any refunds they
        // produced), require force delete - same reasoning as payments
        // below: deleting them silently would erase real return/refund
        // history and, for refunds, leave the bank/cash balance wrong.
        if (invoice.returns && invoice.returns.length > 0) {
          await transaction.rollback();
          const refundCount = invoice.returns.reduce((sum, r) => sum + (r.refunds?.length || 0), 0);
          return res.status(400).json({
            message: `Cannot delete invoice. It has ${invoice.returns.length} associated return/exchange record(s)${refundCount > 0 ? ` and ${refundCount} refund(s)` : ''}. Use force delete to remove them${refundCount > 0 ? ' - any refunds will be reversed' : ''}.`,
            hasReturns: true,
            returnsCount: invoice.returns.length,
            refundsCount: refundCount
          });
        }

        // If there are payments, require force delete
        if (invoice.payments && invoice.payments.length > 0) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Cannot delete invoice. It has ${invoice.payments.length} payment(s) associated. These payments will be reversed if you confirm the deletion.`,
            hasPayments: true,
            paymentsCount: invoice.payments.length,
            payments: invoice.payments.map(p => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              date: p.paymentDate
            }))
          });
        }

        // No stock restoration here: a non-force delete only ever reaches
        // this point for an invoice with no payments, and Record Sale
        // (the only way stock gets deducted) always creates a payment
        // immediately - so an invoice with deducted stock can never land
        // in this branch.

        // Delete all invoice items
        await InvoiceItem.destroy({
          where: { invoiceId: id },
          transaction
        });

        // Delete the invoice
        await this.model.destroy({
          where: { id },
          transaction
        });

        await transaction.commit();
        return res.status(200).json({ 
          message: 'Invoice deleted successfully' 
        });
      }
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new InvoiceController();
