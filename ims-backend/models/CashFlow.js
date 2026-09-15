const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CashFlow = sequelize.define('CashFlow', {
  flow_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'flow_id'
  },
  account_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bank_accounts',
      key: 'account_id'
    },
    onDelete: 'CASCADE',
    field: 'account_id'
  },
  transaction_type: {
    type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer_in', 'transfer_out'),
    allowNull: false,
    field: 'transaction_type'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    field: 'amount',
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    }
  },
  related_account_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bank_accounts',
      key: 'account_id'
    },
    field: 'related_account_id',
    comment: 'For transfers, the other account involved'
  },
  reference_type: {
    type: DataTypes.ENUM('company_transaction', 'supplier_invoice', 'expense', 'manual', 'other', 'invoice', 'supplier_transaction'),
    allowNull: true,
    field: 'reference_type'
  },
  reference_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reference_id',
    comment: 'ID of the related transaction/invoice/expense'
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reference_number'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'payment_method'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  transaction_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'transaction_date'
  },
  balance_before: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'balance_before',
    get() {
      const value = this.getDataValue('balance_before');
      return value ? parseFloat(value) : 0;
    }
  },
  balance_after: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'balance_after',
    get() {
      const value = this.getDataValue('balance_after');
      return value ? parseFloat(value) : 0;
    }
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    field: 'created_by'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'cash_flows',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CashFlow;
