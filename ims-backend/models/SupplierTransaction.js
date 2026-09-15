const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// A supplier purchase/restock ledger entry. Two kinds:
// - 'purchase': goods were received from the supplier (line items live in
//   SupplierTransactionItem) - total_amount is the value of what arrived,
//   amount_paid is whatever was settled at the same time, and the
//   difference increases Supplier.current_balance (what the shop owes).
// - 'payment': paying down an existing balance with no goods received -
//   total_amount is not meaningful here, only amount_paid.
const SupplierTransaction = sequelize.define('SupplierTransaction', {
  trans_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'suppliers',
      key: 'supplier_id'
    },
    onDelete: 'CASCADE'
  },
  type: {
    type: DataTypes.ENUM('purchase', 'payment'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['purchase', 'payment']],
        msg: 'Transaction type must be either purchase or payment'
      }
    }
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const value = this.getDataValue('total_amount');
      return value ? parseFloat(value) : 0.00;
    }
  },
  amount_paid: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const value = this.getDataValue('amount_paid');
      return value ? parseFloat(value) : 0.00;
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  bank_account_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bank_accounts',
      key: 'account_id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'supplier_transactions',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['supplier_id'] },
    { fields: ['type'] },
    { fields: ['transaction_date'] },
    { fields: ['created_by'] }
  ]
});

module.exports = SupplierTransaction;
