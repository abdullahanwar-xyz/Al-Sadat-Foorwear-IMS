const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('online_orders', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      invoiceId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      source: { type: DataTypes.ENUM('instagram', 'tiktok', 'whatsapp', 'shopify'), allowNull: false },
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
      stockReturnedAt: { type: DataTypes.DATE, allowNull: true },
      refundAmount: { type: DataTypes.FLOAT, allowNull: true },
      refundedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('online_orders');
  }
};
