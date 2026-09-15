const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Expense = sequelize.define('Expense', {
  expense_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Expense category is required'
      }
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Expense amount is required'
      },
      min: {
        args: [0.01],
        msg: 'Expense amount must be greater than 0'
      }
    },
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0.00;
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expense_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
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
  tableName: 'expenses',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['category'] },
    { fields: ['expense_date'] },
    { fields: ['created_by'] }
  ]
});

module.exports = Expense;
