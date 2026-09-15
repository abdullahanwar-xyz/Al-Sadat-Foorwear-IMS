const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('refunds', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      returnId: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.FLOAT, allowNull: false },
      method: { type: DataTypes.STRING, allowNull: false, defaultValue: 'cash' },
      bank_account_id: { type: DataTypes.INTEGER, allowNull: true },
      refundDate: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('refunds');
  }
};
