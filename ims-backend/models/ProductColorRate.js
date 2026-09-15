const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');

const ProductColorRate = sequelize.define('ProductColorRate', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    }
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'product_color_rates',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['productId', 'color'],
      name: 'product_color_unique'
    }
  ]
});

ProductColorRate.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(ProductColorRate, { foreignKey: 'productId', as: 'colorRates' });

module.exports = ProductColorRate;
