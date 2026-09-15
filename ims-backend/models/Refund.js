const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Return = require('./Return');
const Invoice = require('./Invoice');

// Mirrors Payment structurally, but for money leaving the shop instead of
// coming in. Anchored to exactly one of two parents:
//  - returnId: a product Return/Exchange refund (the original use case)
//  - invoiceId: an Online Order cancellation refund, which isn't tied to
//    any returned product - nothing was returned, an order was cancelled
// Exactly one of the two is set on any given row (enforced in
// paymentService.recordRefund, not at the DB level).
const Refund = sequelize.define('Refund', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  returnId: { type: DataTypes.INTEGER, allowNull: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: true },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false, defaultValue: 'cash' },
  bank_account_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'bank_accounts', key: 'account_id' }
  },
  refundDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'refunds',
  timestamps: true,
});

Refund.belongsTo(Return, { foreignKey: 'returnId', as: 'return' });
Return.hasMany(Refund, { foreignKey: 'returnId', as: 'refunds' });

// Distinct alias from Return's 'refunds' - Invoice's online-order-cancellation
// refunds are a separate relationship from a product-return's refunds, even
// though both are rows in this same table.
Refund.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasMany(Refund, { foreignKey: 'invoiceId', as: 'orderRefunds' });

module.exports = Refund;
