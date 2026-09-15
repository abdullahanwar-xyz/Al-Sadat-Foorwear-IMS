const SupplierTransaction = require('../models/SupplierTransaction');
const SupplierTransactionItem = require('../models/SupplierTransactionItem');
const Supplier = require('../models/Supplier');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const ProductColorRate = require('../models/ProductColorRate');
const Product = require('../models/Product');
const { getOrCreateDefaultCashAccount } = require('../utils/defaultCashAccount');
const { receiveStock, InsufficientStockError } = require('../utils/stockService');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

// Get all transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const { supplier_id, type, startDate, endDate } = req.query;

    const whereClause = {};

    if (supplier_id) whereClause.supplier_id = supplier_id;
    if (type) whereClause.type = type;

    if (startDate && endDate) {
      whereClause.transaction_date = {
        [Op.between]: [startDate, endDate]
      };
    }

    const transactions = await SupplierTransaction.findAll({
      where: whereClause,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name']
        },
        {
          model: SupplierTransactionItem,
          as: 'items',
          include: [{
            model: ProductColorRate,
            as: 'productColorRate',
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ],
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

// Get single transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await SupplierTransaction.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone']
        },
        {
          model: SupplierTransactionItem,
          as: 'items',
          include: [{
            model: ProductColorRate,
            as: 'productColorRate',
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Error fetching transaction', error: error.message });
  }
};

// Create new transaction - either a 'purchase' (goods received, optionally
// with a payment) or a 'payment' (paying down existing balance, no goods).
exports.createTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      supplier_id,
      type,
      items,
      amount_paid,
      description,
      payment_method,
      bank_account_id,
      reference_number,
      transaction_date
    } = req.body;

    // Validate required fields
    if (!supplier_id || !type) {
      await t.rollback();
      return res.status(400).json({ message: 'Supplier and transaction type are required' });
    }

    if (!['purchase', 'payment'].includes(type)) {
      await t.rollback();
      return res.status(400).json({ message: 'Transaction type must be either purchase or payment' });
    }

    const supplier = await Supplier.findByPk(supplier_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!supplier) {
      await t.rollback();
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const paidAmount = parseFloat(amount_paid) || 0;
    if (paidAmount < 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Amount paid cannot be negative' });
    }

    let totalAmount;
    const resolvedItems = [];

    if (type === 'purchase') {
      if (!Array.isArray(items) || items.length === 0) {
        await t.rollback();
        return res.status(400).json({ message: 'A purchase must include at least one received item' });
      }

      // Validate every line. Two kinds: an inventory line needs an exact
      // product/color/size match, same rule stockService.js uses everywhere
      // else stock moves; a non-inventory line (leather, laces, soles, ...)
      // just needs a description - it never touches stock.
      for (const item of items) {
        const isInventoryItem = item.is_inventory_item !== false;
        const quantity = parseFloat(item.quantity) || 0;
        const unitCost = parseFloat(item.unit_cost);

        if (quantity <= 0 || Number.isNaN(unitCost) || unitCost < 0) {
          await t.rollback();
          return res.status(400).json({ message: 'Each received item needs a valid quantity and unit cost' });
        }

        if (isInventoryItem) {
          const size = parseFloat(item.size);

          if (!item.product_color_rate_id || Number.isNaN(size)) {
            await t.rollback();
            return res.status(400).json({ message: 'Each inventory item needs a valid product and size' });
          }

          const productColorRate = await ProductColorRate.findByPk(item.product_color_rate_id, {
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
            transaction: t
          });
          if (!productColorRate) {
            await t.rollback();
            return res.status(400).json({ message: 'Selected product/color not found' });
          }

          resolvedItems.push({
            is_inventory_item: true,
            product_color_rate_id: item.product_color_rate_id,
            size,
            quantity,
            unit_cost: unitCost,
            line_total: quantity * unitCost,
            label: `${productColorRate.product?.name || 'Item'} (${productColorRate.color}, Size ${size})`
          });
        } else {
          const description = (item.description || '').trim();
          if (!description) {
            await t.rollback();
            return res.status(400).json({ message: 'Each non-inventory item needs a description' });
          }

          resolvedItems.push({
            is_inventory_item: false,
            description,
            quantity,
            unit_cost: unitCost,
            line_total: quantity * unitCost,
            label: description
          });
        }
      }

      totalAmount = resolvedItems.reduce((sum, i) => sum + i.line_total, 0);

      if (paidAmount > totalAmount + 0.01) {
        await t.rollback();
        return res.status(400).json({ message: 'Amount paid cannot exceed the total value of goods received' });
      }
    } else {
      // 'payment' - no goods, just settling existing balance. total_amount
      // mirrors amount_paid so this row is self-consistent (nothing left
      // owed on it) without a payment-vs-purchase special case downstream.
      if (paidAmount <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Payment amount must be greater than 0' });
      }
      totalAmount = paidAmount;
    }

    // Determine target bank/cash account for the payment, if any was made.
    let targetAccountId = null;
    if (paidAmount > 0) {
      if (!payment_method || !['cash', 'bank'].includes(payment_method)) {
        await t.rollback();
        return res.status(400).json({ message: 'Payment method must be either "cash" or "bank"' });
      }
      if (payment_method === 'cash') {
        const defaultCashAccount = await getOrCreateDefaultCashAccount(req.user.user_id);
        targetAccountId = defaultCashAccount.account_id;
      } else {
        if (!bank_account_id) {
          await t.rollback();
          return res.status(400).json({ message: 'Bank account is required for bank payments' });
        }
        const bankAccount = await BankAccount.findByPk(bank_account_id, { transaction: t });
        if (!bankAccount) {
          await t.rollback();
          return res.status(404).json({ message: 'Bank account not found' });
        }
        targetAccountId = bank_account_id;
      }
    }

    const createdTransaction = await SupplierTransaction.create({
      supplier_id,
      type,
      total_amount: totalAmount,
      amount_paid: paidAmount,
      description,
      payment_method: paidAmount > 0 ? payment_method : null,
      bank_account_id: targetAccountId,
      reference_number,
      transaction_date: transaction_date || new Date(),
      created_by: req.user ? req.user.user_id : null
    }, { transaction: t });

    if (type === 'purchase') {
      for (const item of resolvedItems) {
        await SupplierTransactionItem.create({
          supplier_transaction_id: createdTransaction.trans_id,
          is_inventory_item: item.is_inventory_item,
          product_color_rate_id: item.is_inventory_item ? item.product_color_rate_id : null,
          size: item.is_inventory_item ? item.size : null,
          description: item.is_inventory_item ? null : item.description,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          line_total: item.line_total
        }, { transaction: t });

        // Add the received stock - exact product/color/size, creating the
        // size row if this is a size the shop has never carried before.
        // Non-inventory lines (leather, laces, soles, ...) skip this
        // entirely - they only affect cost/balance, never stock.
        if (item.is_inventory_item) {
          await receiveStock(item.product_color_rate_id, item.size, item.quantity, t);
        }
      }
    }

    // A purchase increases what's owed by whatever wasn't paid right now
    // (0 if fully paid). A payment has no goods value to add - it just
    // reduces what's owed by the full amount paid. total_amount === amount_paid
    // for a payment row is purely a display convenience; the balance math
    // must not derive owedDelta from that equality, or a payment would net
    // to zero effect.
    const owedDelta = (type === 'purchase' ? totalAmount : 0) - paidAmount;
    await supplier.update({
      current_balance: parseFloat(supplier.current_balance) + owedDelta
    }, { transaction: t });

    // If money actually changed hands, reflect it on the account and ledger.
    if (paidAmount > 0) {
      const bankAccount = await BankAccount.findByPk(targetAccountId, { transaction: t });
      const balanceBefore = parseFloat(bankAccount.current_balance);
      const newBalance = balanceBefore - paidAmount;

      await bankAccount.update({ current_balance: newBalance }, { transaction: t });

      await CashFlow.create({
        account_id: targetAccountId,
        transaction_type: 'withdrawal',
        amount: paidAmount,
        payment_method,
        description: type === 'purchase'
          ? `Supplier purchase payment: ${supplier.name}${description ? ' - ' + description : ''}`
          : `Supplier payment: ${supplier.name}${description ? ' - ' + description : ''}`,
        reference_type: 'supplier_transaction',
        reference_id: createdTransaction.trans_id,
        balance_before: balanceBefore,
        balance_after: newBalance,
        created_by: req.user ? req.user.user_id : null
      }, { transaction: t });
    }

    await t.commit();

    const fullTransaction = await SupplierTransaction.findByPk(createdTransaction.trans_id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['supplier_id', 'name', 'current_balance'] },
        {
          model: SupplierTransactionItem,
          as: 'items',
          include: [{
            model: ProductColorRate,
            as: 'productColorRate',
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ]
    });

    res.status(201).json({ message: 'Transaction recorded successfully', transaction: fullTransaction });
  } catch (error) {
    await t.rollback();
    if (error instanceof InsufficientStockError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Error creating transaction', error: error.message });
  }
};

// Update transaction - deliberately limited scope: a purchase/payment is a
// point-in-time ledger event, so changing the amounts, items, or type after
// the fact (which would require unwinding and reapplying stock and balance
// effects) isn't supported here. Delete and recreate instead for that. Only
// the descriptive fields are editable.
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, reference_number, transaction_date } = req.body;

    const transaction = await SupplierTransaction.findByPk(id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transaction.update({
      description: description !== undefined ? description : transaction.description,
      reference_number: reference_number !== undefined ? reference_number : transaction.reference_number,
      transaction_date: transaction_date || transaction.transaction_date
    });

    res.json({ message: 'Transaction updated successfully', transaction });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Error updating transaction', error: error.message });
  }
};

// Delete transaction - reverses every effect it had: removes received stock
// back out, reverses the supplier balance change, and reverses the bank/cash
// ledger entry if a payment was recorded.
exports.deleteTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    const transaction = await SupplierTransaction.findByPk(id, {
      include: [{ model: SupplierTransactionItem, as: 'items' }],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const supplier = await Supplier.findByPk(transaction.supplier_id, { transaction: t, lock: t.LOCK.UPDATE });

    // Reverse stock for a purchase's received items - only the inventory
    // lines ever touched stock, so only those need deducting back out.
    if (transaction.type === 'purchase') {
      const { deductExactStock } = require('../utils/stockService');
      for (const item of transaction.items || []) {
        if (item.is_inventory_item) {
          await deductExactStock(item.product_color_rate_id, item.size, item.quantity, t);
        }
      }
    }

    // Reverse the supplier balance effect (same formula as create, negated).
    if (supplier) {
      const owedDelta = (transaction.type === 'purchase' ? parseFloat(transaction.total_amount) : 0) - parseFloat(transaction.amount_paid);
      await supplier.update({
        current_balance: parseFloat(supplier.current_balance) - owedDelta
      }, { transaction: t });
    }

    // Reverse the payment's effect on the bank/cash ledger.
    if (parseFloat(transaction.amount_paid) > 0 && transaction.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(transaction.bank_account_id, { transaction: t });
      if (bankAccount) {
        const balanceBefore = parseFloat(bankAccount.current_balance);
        const newBalance = balanceBefore + parseFloat(transaction.amount_paid);
        await bankAccount.update({ current_balance: newBalance }, { transaction: t });

        await CashFlow.create({
          account_id: transaction.bank_account_id,
          transaction_type: 'deposit',
          amount: parseFloat(transaction.amount_paid),
          payment_method: transaction.payment_method,
          description: `Reversal of deleted supplier transaction #${transaction.trans_id}`,
          reference_type: 'supplier_transaction',
          reference_id: null,
          balance_before: balanceBefore,
          balance_after: newBalance,
          created_by: req.user ? req.user.user_id : null
        }, { transaction: t });
      }
    }

    await SupplierTransactionItem.destroy({ where: { supplier_transaction_id: transaction.trans_id }, transaction: t });
    await transaction.destroy({ transaction: t });

    await t.commit();

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await t.rollback();
    if (error instanceof InsufficientStockError) {
      return res.status(400).json({ message: `Cannot delete: ${error.message}`, details: error.details });
    }
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalSuppliers = await Supplier.count({ where: { status: 'active' } });

    const totalTransactions = await SupplierTransaction.count();

    // Total owed to suppliers (sum of what's still outstanding)
    const [owedResult] = await sequelize.query(`
      SELECT COALESCE(SUM(current_balance), 0) as total_owed
      FROM suppliers
      WHERE status = 'active'
    `);

    // Total balance across the shop's own bank/cash accounts
    const [balanceResult] = await sequelize.query(`
      SELECT COALESCE(SUM(current_balance), 0) as total_balance
      FROM bank_accounts
      WHERE status = 1
    `);

    const recentTransactions = await SupplierTransaction.findAll({
      limit: 10,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name']
        }
      ],
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      totalSuppliers,
      totalTransactions,
      totalOwedToSuppliers: parseFloat(owedResult[0].total_owed),
      totalBalance: parseFloat(balanceResult[0].total_balance),
      recentTransactions
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
};
