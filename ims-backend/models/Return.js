const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');
const User = require('./user');

// One row per return/exchange action (which may touch several invoice
// items at once - see ReturnItem). `type` is a derived summary label
// ('exchange' if any item in the action was an exchange, else 'return');
// the actual per-item behavior lives on ReturnItem.isExchange.
const Return = sequelize.define('Return', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('return', 'exchange'), allowNull: false },
  processedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'user_id' }
  },
  reason: { type: DataTypes.TEXT, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'returns',
  timestamps: true,
});

Return.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasMany(Return, { foreignKey: 'invoiceId', as: 'returns' });

Return.belongsTo(User, { foreignKey: 'processedByUserId', targetKey: 'user_id', as: 'processedBy' });

module.exports = Return;
