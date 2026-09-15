const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  thickness: { type: DataTypes.STRING, allowNull: false },
  collection: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Al Sadat' },
  commission_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Commission percentage that company gives for this product'
  },
  // Archive flag for products with real history (invoice items) that
  // can't be deleted without losing that history - see productController.
  // deleteProduct. New products default to active.
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'products',
  timestamps: true,
});

module.exports = Product;
