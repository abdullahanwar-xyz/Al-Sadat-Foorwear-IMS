const CashFlow = require('../models/CashFlow');
const BankAccount = require('../models/BankAccount');
const User = require('../models/user');
const { sequelize } = require('../config/db');

const cashFlowController = {
  // Get all cash flows with optional filters
  getAllCashFlows: async (req, res) => {
    try {
      const { account_id, transaction_type, startDate, endDate, reference_type } = req.query;
      
      const whereClause = {};
      if (account_id) whereClause.account_id = account_id;
      if (transaction_type) whereClause.transaction_type = transaction_type;
      if (reference_type) whereClause.reference_type = reference_type;
      
      if (startDate && endDate) {
        whereClause.transaction_date = {
          [sequelize.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const cashFlows = await CashFlow.findAll({
        where: whereClause,
        include: [
          {
            model: BankAccount,
            as: 'account',
            attributes: ['account_id', 'account_name', 'account_type', 'bank_name']
          },
          {
            model: BankAccount,
            as: 'relatedAccount',
            attributes: ['account_id', 'account_name', 'account_type'],
            required: false
          },
          {
            model: User,
            as: 'creator',
            attributes: ['user_id', 'user_name', 'user_username']
          }
        ],
        order: [['transaction_date', 'DESC'], ['created_at', 'DESC']]
      });

      res.json(cashFlows);
    } catch (error) {
      console.error('Error fetching cash flows:', error);
      res.status(500).json({ message: 'Failed to fetch cash flows', error: error.message });
    }
  },

  // Get single cash flow by ID
  getCashFlowById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const cashFlow = await CashFlow.findByPk(id, {
        include: [
          {
            model: BankAccount,
            as: 'account',
            attributes: ['account_id', 'account_name', 'account_type', 'bank_name', 'account_number']
          },
          {
            model: BankAccount,
            as: 'relatedAccount',
            attributes: ['account_id', 'account_name', 'account_type'],
            required: false
          },
          {
            model: User,
            as: 'creator',
            attributes: ['user_id', 'user_name', 'user_username']
          }
        ]
      });

      if (!cashFlow) {
        return res.status(404).json({ message: 'Cash flow record not found' });
      }

      res.json(cashFlow);
    } catch (error) {
      console.error('Error fetching cash flow:', error);
      res.status(500).json({ message: 'Failed to fetch cash flow', error: error.message });
    }
  },

  // Get cash flow summary
  getCashFlowSummary: async (req, res) => {
    try {
      const { account_id, startDate, endDate } = req.query;
      
      const whereClause = {};
      if (account_id) whereClause.account_id = account_id;
      
      if (startDate && endDate) {
        whereClause.transaction_date = {
          [sequelize.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const [deposits, withdrawals, transfersIn, transfersOut] = await Promise.all([
        CashFlow.sum('amount', { where: { ...whereClause, transaction_type: 'deposit' } }),
        CashFlow.sum('amount', { where: { ...whereClause, transaction_type: 'withdrawal' } }),
        CashFlow.sum('amount', { where: { ...whereClause, transaction_type: 'transfer_in' } }),
        CashFlow.sum('amount', { where: { ...whereClause, transaction_type: 'transfer_out' } })
      ]);

      const totalInflow = (deposits || 0) + (transfersIn || 0);
      const totalOutflow = (withdrawals || 0) + (transfersOut || 0);

      res.json({
        total_deposits: deposits || 0,
        total_withdrawals: withdrawals || 0,
        total_transfers_in: transfersIn || 0,
        total_transfers_out: transfersOut || 0,
        total_inflow: totalInflow,
        total_outflow: totalOutflow,
        net_cash_flow: totalInflow - totalOutflow
      });
    } catch (error) {
      console.error('Error fetching cash flow summary:', error);
      res.status(500).json({ message: 'Failed to fetch summary', error: error.message });
    }
  },

  // Delete cash flow (admin only, with reversal)
  deleteCashFlow: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      const cashFlow = await CashFlow.findByPk(id, { transaction });
      if (!cashFlow) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Cash flow record not found' });
      }

      const account = await BankAccount.findByPk(cashFlow.account_id, { transaction });
      if (!account) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Associated account not found' });
      }

      // Reverse the transaction
      let newBalance = account.current_balance;
      if (cashFlow.transaction_type === 'deposit' || cashFlow.transaction_type === 'transfer_in') {
        newBalance -= cashFlow.amount;
      } else {
        newBalance += cashFlow.amount;
      }

      await account.update({ current_balance: newBalance }, { transaction });

      // If it's a transfer, reverse the other side too
      if (cashFlow.related_account_id) {
        const relatedAccount = await BankAccount.findByPk(cashFlow.related_account_id, { transaction });
        if (relatedAccount) {
          let relatedNewBalance = relatedAccount.current_balance;
          if (cashFlow.transaction_type === 'transfer_out') {
            relatedNewBalance -= cashFlow.amount;
          } else {
            relatedNewBalance += cashFlow.amount;
          }
          await relatedAccount.update({ current_balance: relatedNewBalance }, { transaction });
        }
      }

      await cashFlow.destroy({ transaction });
      await transaction.commit();

      res.json({ message: 'Cash flow record deleted and transaction reversed' });
    } catch (error) {
      await transaction.rollback();
      console.error('Error deleting cash flow:', error);
      res.status(500).json({ message: 'Failed to delete cash flow', error: error.message });
    }
  }
};

module.exports = cashFlowController;
