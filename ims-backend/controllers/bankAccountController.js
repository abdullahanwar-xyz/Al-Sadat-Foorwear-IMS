const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const User = require('../models/user');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

const bankAccountController = {
  // Get all bank accounts with optional filters
  getAllBankAccounts: async (req, res) => {
    try {
      const { account_type, status } = req.query;

      const whereClause = {};
      if (account_type) whereClause.account_type = account_type;
      if (status !== undefined) whereClause.status = status;

      const accounts = await BankAccount.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['user_id', 'user_name', 'user_username']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json(accounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ message: 'Failed to fetch bank accounts', error: error.message });
    }
  },

  // Get shop's personal bank accounts (for invoice payments) - both real
  // bank accounts and wallet accounts (JazzCash/Easypaisa/etc.), since a
  // payment method requiring "a specific real account" may need either.
  getShopBankAccounts: async (req, res) => {
    try {
      const accounts = await BankAccount.findAll({
        where: {
          account_type: { [Op.in]: ['bank', 'wallet'] },
          status: 1 // Only active accounts
        },
        attributes: ['account_id', 'account_name', 'account_type', 'bank_name', 'account_number', 'current_balance'],
        order: [['account_name', 'ASC']]
      });

      res.json(accounts);
    } catch (error) {
      console.error('Error fetching shop bank accounts:', error);
      res.status(500).json({ message: 'Failed to fetch shop bank accounts', error: error.message });
    }
  },

  // Get single bank account by ID
  getBankAccountById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const account = await BankAccount.findByPk(id, {
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['user_id', 'user_name', 'user_username']
          }
        ]
      });

      if (!account) {
        return res.status(404).json({ message: 'Bank account not found' });
      }

      res.json(account);
    } catch (error) {
      console.error('Error fetching bank account:', error);
      res.status(500).json({ message: 'Failed to fetch bank account', error: error.message });
    }
  },

  // Create new bank account
  createBankAccount: async (req, res) => {
    try {
      const {
        account_name,
        account_number,
        bank_name,
        account_type,
        opening_balance,
        currency,
        branch,
        ifsc_code,
        description
      } = req.body;

      const account = await BankAccount.create({
        account_name,
        account_number,
        bank_name,
        account_type: account_type || 'bank',
        opening_balance: opening_balance || 0,
        current_balance: opening_balance || 0,
        currency: currency || 'PKR',
        branch,
        ifsc_code,
        description,
        created_by: req.user.user_id,
        status: 1
      });

      res.status(201).json({
        message: 'Bank account created successfully',
        account
      });
    } catch (error) {
      console.error('Error creating bank account:', error);
      res.status(500).json({ message: 'Failed to create bank account', error: error.message });
    }
  },

  // Update bank account
  updateBankAccount: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Don't allow direct updates to current_balance
      delete updateData.current_balance;
      delete updateData.created_by;
      delete updateData.created_at;

      const account = await BankAccount.findByPk(id);
      if (!account) {
        return res.status(404).json({ message: 'Bank account not found' });
      }

      await account.update(updateData);

      res.json({
        message: 'Bank account updated successfully',
        account
      });
    } catch (error) {
      console.error('Error updating bank account:', error);
      res.status(500).json({ message: 'Failed to update bank account', error: error.message });
    }
  },

  // Delete bank account
  deleteBankAccount: async (req, res) => {
    try {
      const { id } = req.params;

      const account = await BankAccount.findByPk(id);
      if (!account) {
        return res.status(404).json({ message: 'Bank account not found' });
      }

      // Check if there are any cash flows associated
      const flowCount = await CashFlow.count({ where: { account_id: id } });
      if (flowCount > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete account with existing transactions. Please archive it instead.' 
        });
      }

      await account.destroy();

      res.json({ message: 'Bank account deleted successfully' });
    } catch (error) {
      console.error('Error deleting bank account:', error);
      res.status(500).json({ message: 'Failed to delete bank account', error: error.message });
    }
  },

  // Toggle account status
  toggleAccountStatus: async (req, res) => {
    try {
      const { id } = req.params;

      const account = await BankAccount.findByPk(id);
      if (!account) {
        return res.status(404).json({ message: 'Bank account not found' });
      }

      account.status = account.status === 1 ? 0 : 1;
      await account.save();

      res.json({
        message: 'Account status updated successfully',
        account
      });
    } catch (error) {
      console.error('Error toggling account status:', error);
      res.status(500).json({ message: 'Failed to update account status', error: error.message });
    }
  },

  // Deposit money
  deposit: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        amount, 
        description, 
        reference_number, 
        payment_method,
        transaction_date,
        reference_type,
        reference_id 
      } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const account = await BankAccount.findByPk(id, { transaction });
      if (!account) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Bank account not found' });
      }

      const balanceBefore = account.current_balance;
      const balanceAfter = parseFloat(balanceBefore) + parseFloat(amount);

      // Update account balance
      await account.update({ current_balance: balanceAfter }, { transaction });

      // Create cash flow entry
      const cashFlow = await CashFlow.create({
        account_id: id,
        transaction_type: 'deposit',
        amount,
        reference_type: reference_type || 'manual',
        reference_id,
        reference_number,
        payment_method,
        description,
        transaction_date: transaction_date || new Date(),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        created_by: req.user.user_id
      }, { transaction });

      await transaction.commit();

      res.json({
        message: 'Deposit recorded successfully',
        cashFlow,
        account
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error recording deposit:', error);
      res.status(500).json({ message: 'Failed to record deposit', error: error.message });
    }
  },

  // Withdraw money
  withdraw: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        amount, 
        description, 
        reference_number, 
        payment_method,
        transaction_date,
        reference_type,
        reference_id 
      } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const account = await BankAccount.findByPk(id, { transaction });
      if (!account) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Bank account not found' });
      }

      const balanceBefore = account.current_balance;
      const balanceAfter = parseFloat(balanceBefore) - parseFloat(amount);

      // Update account balance
      await account.update({ current_balance: balanceAfter }, { transaction });

      // Create cash flow entry
      const cashFlow = await CashFlow.create({
        account_id: id,
        transaction_type: 'withdrawal',
        amount,
        reference_type: reference_type || 'manual',
        reference_id,
        reference_number,
        payment_method,
        description,
        transaction_date: transaction_date || new Date(),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        created_by: req.user.user_id
      }, { transaction });

      await transaction.commit();

      res.json({
        message: 'Withdrawal recorded successfully',
        cashFlow,
        account
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error recording withdrawal:', error);
      res.status(500).json({ message: 'Failed to record withdrawal', error: error.message });
    }
  },

  // Transfer between accounts
  transfer: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { from_account_id, to_account_id, amount, description, reference_number, transaction_date } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      if (from_account_id === to_account_id) {
        return res.status(400).json({ message: 'Cannot transfer to the same account' });
      }

      const fromAccount = await BankAccount.findByPk(from_account_id, { transaction });
      const toAccount = await BankAccount.findByPk(to_account_id, { transaction });

      if (!fromAccount || !toAccount) {
        await transaction.rollback();
        return res.status(404).json({ message: 'One or both accounts not found' });
      }

      const fromBalanceBefore = fromAccount.current_balance;
      const fromBalanceAfter = parseFloat(fromBalanceBefore) - parseFloat(amount);
      
      const toBalanceBefore = toAccount.current_balance;
      const toBalanceAfter = parseFloat(toBalanceBefore) + parseFloat(amount);

      // Update both accounts
      await fromAccount.update({ current_balance: fromBalanceAfter }, { transaction });
      await toAccount.update({ current_balance: toBalanceAfter }, { transaction });

      // Create transfer out entry
      const transferOut = await CashFlow.create({
        account_id: from_account_id,
        transaction_type: 'transfer_out',
        amount,
        related_account_id: to_account_id,
        reference_type: 'manual',
        reference_number,
        description: description || `Transfer to ${toAccount.account_name}`,
        transaction_date: transaction_date || new Date(),
        balance_before: fromBalanceBefore,
        balance_after: fromBalanceAfter,
        created_by: req.user.user_id
      }, { transaction });

      // Create transfer in entry
      const transferIn = await CashFlow.create({
        account_id: to_account_id,
        transaction_type: 'transfer_in',
        amount,
        related_account_id: from_account_id,
        reference_type: 'manual',
        reference_number,
        description: description || `Transfer from ${fromAccount.account_name}`,
        transaction_date: transaction_date || new Date(),
        balance_before: toBalanceBefore,
        balance_after: toBalanceAfter,
        created_by: req.user.user_id
      }, { transaction });

      await transaction.commit();

      res.json({
        message: 'Transfer completed successfully',
        from_account: fromAccount,
        to_account: toAccount,
        transfer_out: transferOut,
        transfer_in: transferIn
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error processing transfer:', error);
      res.status(500).json({ message: 'Failed to process transfer', error: error.message });
    }
  },

  // Get account statistics
  getAccountStats: async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const whereClause = { account_id: id };
      if (startDate && endDate) {
        whereClause.transaction_date = {
          [sequelize.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const [deposits, withdrawals, account] = await Promise.all([
        CashFlow.sum('amount', { 
          where: { ...whereClause, transaction_type: ['deposit', 'transfer_in'] } 
        }),
        CashFlow.sum('amount', { 
          where: { ...whereClause, transaction_type: ['withdrawal', 'transfer_out'] } 
        }),
        BankAccount.findByPk(id)
      ]);

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      res.json({
        account_name: account.account_name,
        current_balance: account.current_balance,
        opening_balance: account.opening_balance,
        total_deposits: deposits || 0,
        total_withdrawals: withdrawals || 0,
        net_change: (deposits || 0) - (withdrawals || 0)
      });
    } catch (error) {
      console.error('Error fetching account stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
    }
  }
};

module.exports = bankAccountController;
