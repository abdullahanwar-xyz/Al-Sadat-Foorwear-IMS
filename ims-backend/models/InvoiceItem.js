const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');
const Product = require('./Product');
const ProductColorRate = require('./ProductColorRate');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productColorRateId: { type: DataTypes.INTEGER, allowNull: false },
  itemName: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  color: { type: DataTypes.STRING },
  size: { type: DataTypes.FLOAT },
  quantity: { type: DataTypes.FLOAT, allowNull: false },
  rate: { type: DataTypes.FLOAT, allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false }, // Add the missing total field
  totalFeet: { type: DataTypes.FLOAT }, 
  grossValue: { type: DataTypes.FLOAT },
  discount: { type: DataTypes.FLOAT, defaultValue: 0 },
  netValue: { type: DataTypes.FLOAT },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // Add order column to preserve sequence
  // Running total of how much of this line has been returned via
  // Return/Exchange actions. Updated (with a row lock) inside the same
  // transaction as each return - the enforcement mechanism that prevents
  // over-returning across multiple separate return actions.
  returnedQuantity: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'invoice_items',
  timestamps: false,
});

InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });

InvoiceItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(InvoiceItem, { foreignKey: 'productId', as: 'invoiceItems' });

InvoiceItem.belongsTo(ProductColorRate, { foreignKey: 'productColorRateId', as: 'productColorRate' });
ProductColorRate.hasMany(InvoiceItem, { foreignKey: 'productColorRateId', as: 'invoiceItems' });

module.exports = InvoiceItem;
