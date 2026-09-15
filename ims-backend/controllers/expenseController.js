const Expense = require('../models/Expense');
const User = require('../models/user');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const { resolveSettlementAccount } = require('../utils/paymentService');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

// Get all expenses with filtering
const getAllExpenses = async (req, res) => {
  try {
    const {
      category,
      start_date,
      end_date,
      payment_method
    } = req.query;

    const where = {};

    if (category) {
      where.category = category;
    }

    if (payment_method) {
      where.payment_method = payment_method;
    }

    if (start_date && end_date) {
      where.expense_date = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      where.expense_date = {
        [Op.gte]: start_date
      };
    } else if (end_date) {
      where.expense_date = {
        [Op.lte]: end_date
      };
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ],
      order: [['expense_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses',
      error: error.message
    });
  }
};

// Get expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ]
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense',
      error: error.message
    });
  }
};

// Create new expense
const createExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      category,
      amount,
      description,
      expense_date,
      payment_method,
      bank_account_id,
      reference_number
    } = req.body;

    // Validate required fields
    if (!category || !amount || !expense_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Category, amount, and expense date are required'
      });
    }

    // Validate payment method
    if (!payment_method) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    // Resolve the target account against the real, configured Payment
    // Methods list (Cash, Card, Bank Transfer, Check, Easypaisa, JazzCash,
    // ...) instead of a hardcoded 'cash'/'bank' literal check - same helper
    // Record Sale/Return-Exchange/Payment Modal already use.
    let targetAccountId;
    try {
      targetAccountId = await resolveSettlementAccount(payment_method, bank_account_id, req.user.user_id, transaction);
    } catch (err) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    const bankAccount = await BankAccount.findByPk(targetAccountId, { transaction });
    if (!bankAccount) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Create expense
    const expense = await Expense.create({
      category,
      amount,
      description,
      expense_date,
      payment_method,
      bank_account_id: targetAccountId,
      reference_number,
      created_by: req.user.user_id
    }, { transaction });

    // Update bank account balance (withdrawal)
    const balanceBefore = parseFloat(bankAccount.current_balance);
    const newBalance = balanceBefore - parseFloat(amount);
    
    await bankAccount.update({
      current_balance: newBalance
    }, { transaction });

    // Create cash flow entry (withdrawal)
    await CashFlow.create({
      account_id: targetAccountId,
      transaction_type: 'withdrawal',
      amount: parseFloat(amount),
      payment_method,
      description: `Expense: ${category}${description ? ' - ' + description : ''}`,
      reference_type: 'expense',
      reference_id: expense.expense_id,
      balance_before: balanceBefore,
      balance_after: newBalance,
      created_by: req.user.user_id
    }, { transaction });

    await transaction.commit();

    // Fetch created expense with associations
    const createdExpense = await Expense.findByPk(expense.expense_id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: createdExpense
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating expense',
      error: error.message
    });
  }
};

// Delete expense - reverses the bank/cash account balance change and
// removes the CashFlow entry the expense created, so deleting it leaves
// the account exactly as if the expense had never been recorded (same
// principle as invoiceController's payment/refund reversal on delete).
const deleteExpense = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id, { transaction });

    if (!expense) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    const cashFlowEntries = await CashFlow.findAll({
      where: { reference_type: 'expense', reference_id: expense.expense_id },
      transaction
    });

    for (const entry of cashFlowEntries) {
      const bankAccount = await BankAccount.findByPk(entry.account_id, { transaction });
      if (bankAccount) {
        const balanceBefore = parseFloat(bankAccount.current_balance);
        const delta = entry.transaction_type === 'deposit' ? -parseFloat(entry.amount) : parseFloat(entry.amount);
        await bankAccount.update({ current_balance: balanceBefore + delta }, { transaction });
      }
      await entry.destroy({ transaction });
    }

    await expense.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expense',
      error: error.message
    });
  }
};

// Get expenses by category (for reports)
const getExpensesByCategory = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.expense_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const expenses = await Expense.findAll({
      where,
      attributes: [
        'category',
        [Expense.sequelize.fn('SUM', Expense.sequelize.col('amount')), 'total_amount'],
        [Expense.sequelize.fn('COUNT', Expense.sequelize.col('expense_id')), 'count']
      ],
      group: ['category'],
      order: [[Expense.sequelize.fn('SUM', Expense.sequelize.col('amount')), 'DESC']]
    });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    console.error('Error fetching expenses by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses by category',
      error: error.message
    });
  }
};

// Get expense statistics
const getExpenseStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.expense_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const stats = await Expense.findOne({
      where,
      attributes: [
        [Expense.sequelize.fn('SUM', Expense.sequelize.col('amount')), 'total_expenses'],
        [Expense.sequelize.fn('COUNT', Expense.sequelize.col('expense_id')), 'total_count'],
        [Expense.sequelize.fn('AVG', Expense.sequelize.col('amount')), 'average_expense']
      ]
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching expense statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  deleteExpense,
  getExpensesByCategory,
  getExpenseStats
};
