const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const Payment = require('../models/Payment');
const Refund = require('../models/Refund');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');
const { getOrCreateDefaultCashAccount } = require('./defaultCashAccount');

// Resolves which account a payment/refund should hit: the caller-selected
// bank account if this method is configured to require one, otherwise the
// shop's default cash register - covering every payment method (Cash,
// Card, Check, Easypaisa, JazzCash, ...) the same way Cash always worked,
// instead of only recognizing the two originally-hardcoded 'cash'/'bank'
// literals and silently skipping the account/cash-flow update for anything
// else. An unrecognized method (e.g. a value from before this method was
// configured) falls back to "does it have a bank_account_id?" so it still
// degrades to the old cash/bank behavior rather than erroring.
async function resolveSettlementAccount(method, bank_account_id, userId, transaction) {
  const paymentMethodRecord = method
    ? await PaymentMethod.findOne({ where: { value: method }, transaction })
    : null;
  const requiresBankAccount = paymentMethodRecord
    ? !!paymentMethodRecord.requiresBankAccount
    : !!bank_account_id;

  if (requiresBankAccount) {
    if (!bank_account_id) {
      throw new Error('Bank account is required for this payment method');
    }
    return bank_account_id;
  }

  const defaultCashAccount = await getOrCreateDefaultCashAccount(userId);
  return defaultCashAccount.account_id;
}

// Records a payment against an invoice: creates the Payment row, updates the
// target bank/cash account balance, writes a CashFlow deposit entry, and
// recalculates the invoice's status/remainingAmount. Shared by the normal
// payment-collection flow (paymentController) and the Return/Exchange
// "customer owes more" settlement.
async function recordPayment({ invoiceId, amount, method, bank_account_id, paymentDate, userId, returnId, referenceLabel, skipStatusRecalc }, transaction) {
  const invoice = await Invoice.findByPk(invoiceId, { transaction });
  if (!invoice) throw new Error('Invoice not found');

  const targetAccountId = await resolveSettlementAccount(method, bank_account_id, userId, transaction);

  const payment = await Payment.create({
    invoiceId,
    amount,
    method,
    paymentDate: paymentDate || new Date(),
    bank_account_id: targetAccountId,
    returnId: returnId || null,
  }, { transaction });

  if (targetAccountId) {
    const bankAccount = await BankAccount.findByPk(targetAccountId, { transaction });
    if (!bankAccount) throw new Error('Bank account not found');

    const balanceBefore = parseFloat(bankAccount.current_balance);
    const newBalance = balanceBefore + parseFloat(amount);

    await bankAccount.update({ current_balance: newBalance }, { transaction });

    await CashFlow.create({
      account_id: targetAccountId,
      transaction_type: 'deposit',
      amount: parseFloat(amount),
      payment_method: method,
      description: referenceLabel || `Payment received for Invoice #${invoice.invoiceNumber}`,
      reference_type: 'other',
      reference_id: invoiceId,
      transaction_date: paymentDate || new Date(),
      balance_before: balanceBefore,
      balance_after: newBalance,
      created_by: userId
    }, { transaction });
  }

  // An Exchange settlement targets a brand-new invoice whose status was
  // already deliberately set (paid, remainingAmount 0) at creation - the
  // generic "sum all payments against this invoiceId" recompute below
  // would be wrong there, since the bulk of the new invoice's value was
  // already covered by the old invoice's original payment, not by this
  // settlement payment alone.
  if (!skipStatusRecalc) {
    const allPayments = await Payment.findAll({ where: { invoiceId: invoice.id }, transaction });
    const totalPaidAmount = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
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

  return { payment, cashFlowRecorded: !!targetAccountId };
}

// Records a refund tied to either a Return (product return/exchange) or an
// Invoice (Online Order cancellation, where nothing was returned - the
// whole order was cancelled): creates the Refund row, deducts from the
// source bank/cash account, and writes a CashFlow withdrawal entry.
// Deliberately does NOT touch Invoice.netAmount/status/remainingAmount -
// the original invoice stays a historical record of what was sold; refunds
// live as a separate, additive ledger (same relationship payments already
// have to invoices, just in reverse). Exactly one of returnId/invoiceId
// must be provided.
async function recordRefund({ returnId, invoiceId, amount, method, bank_account_id, refundDate, userId, referenceLabel }, transaction) {
  if (!returnId && !invoiceId) {
    throw new Error('recordRefund requires either returnId or invoiceId');
  }
  if (returnId && invoiceId) {
    throw new Error('recordRefund accepts only one of returnId or invoiceId, not both');
  }

  const targetAccountId = await resolveSettlementAccount(method, bank_account_id, userId, transaction);

  const refund = await Refund.create({
    returnId: returnId || null,
    invoiceId: invoiceId || null,
    amount,
    method,
    bank_account_id: targetAccountId,
    refundDate: refundDate || new Date(),
  }, { transaction });

  if (targetAccountId) {
    const bankAccount = await BankAccount.findByPk(targetAccountId, { transaction });
    if (!bankAccount) throw new Error('Bank account not found');

    const balanceBefore = parseFloat(bankAccount.current_balance);
    const newBalance = balanceBefore - parseFloat(amount);

    await bankAccount.update({ current_balance: newBalance }, { transaction });

    await CashFlow.create({
      account_id: targetAccountId,
      transaction_type: 'withdrawal',
      amount: parseFloat(amount),
      payment_method: method,
      description: referenceLabel || (returnId ? `Refund for Return #${returnId}` : `Refund for cancelled Invoice #${invoiceId}`),
      reference_type: 'other',
      reference_id: returnId || invoiceId,
      transaction_date: refundDate || new Date(),
      balance_before: balanceBefore,
      balance_after: newBalance,
      created_by: userId
    }, { transaction });
  }

  return { refund, cashFlowRecorded: !!targetAccountId };
}

module.exports = { recordPayment, recordRefund, resolveSettlementAccount };
