const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Customer = require('./Customer');
const { generateDocumentNumber } = require('../utils/invoiceNumber');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  invoiceNumber: {
    type: DataTypes.STRING,
    unique: true,
    defaultValue: function() {
      // Generate a default invoice number if not provided
      // The actual value will be set in the create methods
      return generateDocumentNumber('INV');
    }
  },
  company: { type: DataTypes.STRING },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  grossAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  discount: { type: DataTypes.FLOAT, defaultValue: 0 },
  taxAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  netAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  remainingAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  stockDeducted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Null for every ordinary Record Sale invoice. Set (mirroring
  // OnlineOrder.source) only for an invoice placed through Online Orders,
  // so Reports/Dashboard can filter/group by channel without a join. Plain
  // text, not an enum - see OnlineOrderSource for the manageable list of
  // values the combobox offers.
  source: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: 'invoices',
  timestamps: true,
});

Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });

module.exports = Invoice;
