const BaseController = require('./baseController');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const { Op } = require('sequelize');
const { recordPayment } = require('../utils/paymentService');

class PaymentController extends BaseController {
  constructor() {
    super(Payment);
  }

  // Override getAll to include invoice details
  getAll = async (req, res) => {
    try {
      const payments = await this.model.findAll({
        include: [
          { 
            model: Invoice,
            as: 'invoice', // Add the 'as' keyword to specify the alias
            include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }] 
          }
        ]
      });
      return res.status(200).json(payments);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Get a single payment by id
  getById = async (req, res) => {
    try {
      const payment = await this.model.findByPk(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      return res.status(200).json(payment);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Delete a payment - a completed payment can no longer be edited (see
  // routes: the PUT route was removed entirely), only deleted for a genuine
  // mistake. Deletion reverses the same bank/cash balance effect
  // recordPayment created, and recalculates the invoice's status/
  // remainingAmount as if this payment never existed.
  //
  // Unlike Expense deletion, this doesn't hunt for "the" CashFlow row to
  // delete: recordPayment tags every payment's entry with reference_id =
  // invoiceId (not the payment's own id), so a second payment on the same
  // invoice would share that reference and there'd be no reliable way to
  // tell them apart. Instead this creates a new compensating withdrawal
  // entry, the same pattern invoiceController's reversePayments already
  // uses for a force-deleted invoice - the audit trail keeps both the
  // original deposit and its reversal rather than erasing history.
  delete = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();

    try {
      const payment = await this.model.findByPk(req.params.id, { transaction });
      if (!payment) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Payment not found' });
      }

      if (payment.bank_account_id) {
        const bankAccount = await BankAccount.findByPk(payment.bank_account_id, { transaction });
        if (bankAccount) {
          const balanceBefore = parseFloat(bankAccount.current_balance);
          const newBalance = balanceBefore - parseFloat(payment.amount);

          await bankAccount.update({ current_balance: newBalance }, { transaction });

          await CashFlow.create({
            account_id: payment.bank_account_id,
            transaction_type: 'withdrawal',
            amount: parseFloat(payment.amount),
            payment_method: payment.method,
            description: `Payment reversal for deleted payment #${payment.id} (Invoice #${payment.invoiceId})`,
            reference_type: 'invoice',
            reference_id: payment.invoiceId,
            transaction_date: new Date(),
            balance_before: balanceBefore,
            balance_after: newBalance,
            created_by: req.user?.user_id
          }, { transaction });
        } else {
          console.warn(`Bank account ${payment.bank_account_id} not found for payment reversal`);
        }
      }

      // Recompute the invoice's status/remainingAmount as if this payment
      // never existed - same formula recordPayment uses on create.
      const invoice = await Invoice.findByPk(payment.invoiceId, { transaction });
      if (invoice) {
        const remainingPayments = await this.model.findAll({
          where: { invoiceId: payment.invoiceId, id: { [Op.ne]: payment.id } },
          transaction
        });
        const totalPaidAmount = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const netAmount = parseFloat(invoice.netAmount);
        const remainingAmount = netAmount - totalPaidAmount;

        let status;
        if (remainingAmount <= 0) status = 'paid';
        else if (totalPaidAmount > 0) status = 'partial';
        else status = 'unpaid';

        await invoice.update({
          status,
          remainingAmount: Math.max(0, parseFloat(remainingAmount.toFixed(2)))
        }, { transaction });
      }

      await payment.destroy({ transaction });

      await transaction.commit();
      return res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      console.error('Error deleting payment:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Get payments by invoice ID
  getByInvoiceId = async (req, res) => {
    try {
      const payments = await this.model.findAll({
        where: { invoiceId: req.params.invoiceId }
      });
      return res.status(200).json(payments);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Create payment with invoice validation
  create = async (req, res) => {
    const transaction = await this.model.sequelize.transaction();

    try {
      const { invoiceId, amount, method, paymentDate, bank_account_id } = req.body;
      const userId = req.user?.user_id || 1; // Get from auth middleware

      const invoice = await Invoice.findByPk(invoiceId, { transaction });
      if (!invoice) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Invoice not found' });
      }

      const { payment, cashFlowRecorded } = await recordPayment(
        { invoiceId, amount, method, paymentDate, bank_account_id, userId },
        transaction
      );

      await transaction.commit();

      return res.status(201).json({
        message: 'Payment created successfully',
        payment,
        cashFlowRecorded
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating payment:', error);

      if (error.message === 'Bank account is required for this payment method' || error.message === 'Invoice not found') {
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

  // Get payments by date range
  getByDateRange = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const payments = await this.model.findAll({
        where: {
          date: {
            [this.model.sequelize.Op.between]: [startDate, endDate]
          }
        },
        include: [{ model: Invoice, include: [Customer] }]
      });
      return res.status(200).json(payments);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new PaymentController();
