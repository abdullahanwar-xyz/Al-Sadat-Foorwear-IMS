const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  method: { type: DataTypes.STRING, defaultValue: 'cash' },
  paymentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  bank_account_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bank_accounts',
      key: 'account_id'
    }
  },
  // Set when this payment is a top-up collected during an Exchange (the new
  // item cost more than what was returned) - links it back to that Return
  // for reporting, distinguishing it from a normal installment payment.
  returnId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'payments',
  timestamps: true,
});

Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });

module.exports = Payment;
