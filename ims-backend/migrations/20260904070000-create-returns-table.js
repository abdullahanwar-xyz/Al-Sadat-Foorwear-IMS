const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('returns', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      invoiceId: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.ENUM('return', 'exchange'), allowNull: false },
      processedByUserId: { type: DataTypes.INTEGER, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('returns');
  }
};
