const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PaymentMethod = sequelize.define('PaymentMethod', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Unique identifier value for the payment method (e.g., cash, card, bank_transfer)',
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'DollarSign',
    comment: 'Lucide icon name (e.g., Wallet, CreditCard, Landmark)',
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '1 = Active, 0 = Inactive',
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Order in which the payment method should be displayed',
  },
  requiresBankAccount: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether checkout must collect a bank account for this method (vs. settling to the shop cash register)',
  },
}, {
  tableName: 'payment_methods',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PaymentMethod;
