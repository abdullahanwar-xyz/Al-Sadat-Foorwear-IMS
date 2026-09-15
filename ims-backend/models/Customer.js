const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: DataTypes.STRING,
  address: DataTypes.STRING,
  // Archive flag for customers with real history (payments/invoices) that
  // can't be deleted without losing that history - see customerController.
  // delete. New customers default to active.
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'customers',
  timestamps: true,
});

module.exports = Customer;
