const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const SupplierTransaction = require('./SupplierTransaction');
const ProductColorRate = require('./ProductColorRate');

// One row per item received in a 'purchase'-type SupplierTransaction.
// unit_cost is what the shop paid the supplier - deliberately separate
// from ProductColorRate.rate (the shop's own selling price) since the two
// are never the same number.
//
// Two kinds of line, distinguished by is_inventory_item:
// - true (the default): a real product/color/size received into stock.
//   product_color_rate_id and size are set, description is null, and
//   receiving/deleting this line moves stock via stockService.
// - false: something the supplier sold that isn't finished-shoe inventory
//   (leather, laces, soles, ...). product_color_rate_id and size are null,
//   description carries the free-text label, and it never touches stock -
//   it only contributes to the transaction's total and the supplier's
//   owed balance, same as an inventory line.
const SupplierTransactionItem = sequelize.define('SupplierTransactionItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  supplier_transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'supplier_transactions',
      key: 'trans_id'
    },
    onDelete: 'CASCADE'
  },
  is_inventory_item: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  product_color_rate_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'product_color_rates',
      key: 'id'
    }
  },
  size: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Quantity received must be at least 1'
      }
    }
  },
  unit_cost: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    get() {
      const value = this.getDataValue('unit_cost');
      return value ? parseFloat(value) : 0.00;
    }
  },
  line_total: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    get() {
      const value = this.getDataValue('line_total');
      return value ? parseFloat(value) : 0.00;
    }
  }
}, {
  tableName: 'supplier_transaction_items',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['supplier_transaction_id'] },
    { fields: ['product_color_rate_id'] }
  ]
});

SupplierTransactionItem.belongsTo(SupplierTransaction, { foreignKey: 'supplier_transaction_id', as: 'transaction' });
SupplierTransaction.hasMany(SupplierTransactionItem, { foreignKey: 'supplier_transaction_id', as: 'items' });

SupplierTransactionItem.belongsTo(ProductColorRate, { foreignKey: 'product_color_rate_id', as: 'productColorRate' });

module.exports = SupplierTransactionItem;
