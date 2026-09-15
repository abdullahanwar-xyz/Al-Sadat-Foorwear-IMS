const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('return_items', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      returnId: { type: DataTypes.INTEGER, allowNull: false },
      invoiceItemId: { type: DataTypes.INTEGER, allowNull: false },
      returnedQuantity: { type: DataTypes.FLOAT, allowNull: false },
      refundRate: { type: DataTypes.FLOAT, allowNull: false },
      refundAmount: { type: DataTypes.FLOAT, allowNull: false },
      isExchange: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      newProductColorRateId: { type: DataTypes.INTEGER, allowNull: true },
      newSize: { type: DataTypes.FLOAT, allowNull: true },
      newQuantity: { type: DataTypes.FLOAT, allowNull: true },
      newRate: { type: DataTypes.FLOAT, allowNull: true },
      newItemName: { type: DataTypes.STRING, allowNull: true },
      priceDifference: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('return_items');
  }
};
