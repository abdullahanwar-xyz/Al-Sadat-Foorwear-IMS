const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BankAccount = sequelize.define('BankAccount', {
  account_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'account_id'
  },
  account_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'account_name'
  },
  account_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'account_number'
  },
  bank_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'bank_name'
  },
  // 'wallet' covers JazzCash/Easypaisa/etc. - real tracked accounts distinct
  // from a bank account (no IBAN/branch, different settlement rhythm) and
  // from the physical cash register.
  account_type: {
    type: DataTypes.ENUM('bank', 'cash', 'wallet'),
    allowNull: false,
    defaultValue: 'bank',
    field: 'account_type'
  },
  opening_balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'opening_balance',
    get() {
      const value = this.getDataValue('opening_balance');
      return value ? parseFloat(value) : 0;
    }
  },
  current_balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'current_balance',
    get() {
      const value = this.getDataValue('current_balance');
      return value ? parseFloat(value) : 0;
    }
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'PKR',
    field: 'currency'
  },
  branch: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'branch'
  },
  ifsc_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ifsc_code'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    field: 'status',
    comment: '1 = Active, 0 = Inactive'
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
  tableName: 'bank_accounts',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = BankAccount;
