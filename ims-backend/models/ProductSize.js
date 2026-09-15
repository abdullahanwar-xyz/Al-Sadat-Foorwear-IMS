const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ProductColorRate = require('./ProductColorRate');

const ProductSize = sequelize.define('ProductSize', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productColorRateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: ProductColorRate,
      key: 'id'
    }
  },
  size: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: 'Size in feet (e.g., 20, 18, 14)'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Available quantity for this size'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'feet',
    comment: 'Unit of measurement (feet, meters, etc.)'
  }
}, {
  tableName: 'product_sizes',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['productColorRateId', 'size'],
      name: 'product_color_size_unique'
    }
  ]
});

ProductSize.belongsTo(ProductColorRate, { foreignKey: 'productColorRateId', as: 'productColorRate' });
ProductColorRate.hasMany(ProductSize, { foreignKey: 'productColorRateId', as: 'sizes' });

module.exports = ProductSize;
