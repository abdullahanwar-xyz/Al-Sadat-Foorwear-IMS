const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');

// Companion, one-to-one side-table for an Invoice placed through the Online
// Orders workflow (Instagram/TikTok/WhatsApp/Shopify). The Invoice itself
// (and its InvoiceItems/Payments) is the real sale record from the moment
// the order is placed - this table only carries what Record Sale never
// needs: channel, delivery details, and the fulfillment lifecycle. Kept
// deliberately separate from Invoice.status, which already means payment
// status (paid/partial/unpaid) everywhere else in the app.
const OnlineOrder = sequelize.define('OnlineOrder', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  // Plain text (not an enum) - see OnlineOrderSource for the manageable
  // list of values the order-placement combobox offers.
  source: { type: DataTypes.STRING(50), allowNull: false },
  // Snapshotted from Customer.address at order time - stays correct as a
  // record of where THIS order was shipped even if the customer's address
  // on file later changes.
  deliveryAddress: { type: DataTypes.STRING, allowNull: false },
  deliveryCharge: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 500 },
  fulfillmentStatus: {
    type: DataTypes.ENUM('pending', 'shipped', 'delivered', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  shippedAt: { type: DataTypes.DATE, allowNull: true },
  deliveredAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  cancellationReason: { type: DataTypes.STRING, allowNull: true },
  // Set only once stock is actually confirmed back on the shelf - never set
  // automatically for a post-shipment cancellation (see
  // onlineOrderController.confirmStockReceived).
  stockReturnedAt: { type: DataTypes.DATE, allowNull: true },
  refundAmount: { type: DataTypes.FLOAT, allowNull: true },
  refundedAt: { type: DataTypes.DATE, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'online_orders',
  timestamps: true,
});

OnlineOrder.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasOne(OnlineOrder, { foreignKey: 'invoiceId', as: 'onlineOrder' });

module.exports = OnlineOrder;
