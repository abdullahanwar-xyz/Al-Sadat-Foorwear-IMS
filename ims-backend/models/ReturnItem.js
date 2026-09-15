const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Return = require('./Return');
const InvoiceItem = require('./InvoiceItem');

// One row per original invoice item touched by a return/exchange action.
// refundAmount = returnedQuantity * refundRate (quantity * rate, matching
// the corrected Record Sale math - not the old feet-based calculation).
// When isExchange is true, the new item(s) this old item was swapped for
// live in the ExchangeItem child table - one returned item can be exchanged
// for several different new items, not just one.
const ReturnItem = sequelize.define('ReturnItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  returnId: { type: DataTypes.INTEGER, allowNull: false },
  invoiceItemId: { type: DataTypes.INTEGER, allowNull: false },
  returnedQuantity: { type: DataTypes.FLOAT, allowNull: false },
  refundRate: { type: DataTypes.FLOAT, allowNull: false },
  refundAmount: { type: DataTypes.FLOAT, allowNull: false },
  isExchange: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // sum(exchangeItems.quantity * rate) - refundAmount for exchanges, or
  // -refundAmount for a pure return. Positive = customer owed more, negative
  // = shop owes customer. Snapshotted so historical display doesn't drift if
  // rates change.
  priceDifference: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'return_items',
  timestamps: true,
});

ReturnItem.belongsTo(Return, { foreignKey: 'returnId', as: 'return' });
Return.hasMany(ReturnItem, { foreignKey: 'returnId', as: 'items' });

ReturnItem.belongsTo(InvoiceItem, { foreignKey: 'invoiceItemId', as: 'invoiceItem' });
InvoiceItem.hasMany(ReturnItem, { foreignKey: 'invoiceItemId', as: 'returnItems' });

module.exports = ReturnItem;
