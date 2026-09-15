const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ReturnItem = require('./ReturnItem');
const InvoiceItem = require('./InvoiceItem');

// One row per new item added to an exchange - a single ReturnItem (one old
// item being exchanged out) can have several of these, letting one returned
// item be swapped for multiple different new items in one action. rate is
// snapshotted here (like ReturnItem.refundRate) so historical display
// doesn't drift if the product's rate changes later.
const ExchangeItem = sequelize.define('ExchangeItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  returnItemId: { type: DataTypes.INTEGER, allowNull: false },
  productColorRateId: { type: DataTypes.INTEGER, allowNull: false },
  size: { type: DataTypes.FLOAT, allowNull: false },
  quantity: { type: DataTypes.FLOAT, allowNull: false },
  rate: { type: DataTypes.FLOAT, allowNull: false },
  // The real InvoiceItem row created on the invoice for this new item -
  // fully trackable for its own future returns/exchanges, exactly like any
  // other line. Set right after creation, once the InvoiceItem exists.
  newInvoiceItemId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'exchange_items',
  timestamps: true,
});

ExchangeItem.belongsTo(ReturnItem, { foreignKey: 'returnItemId', as: 'returnItem' });
ReturnItem.hasMany(ExchangeItem, { foreignKey: 'returnItemId', as: 'exchangeItems' });

ExchangeItem.belongsTo(InvoiceItem, { foreignKey: 'newInvoiceItemId', as: 'newInvoiceItem' });

module.exports = ExchangeItem;
