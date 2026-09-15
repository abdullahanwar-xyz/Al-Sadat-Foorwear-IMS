const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('online_order_sources', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      value: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    const now = new Date();
    await queryInterface.bulkInsert('online_order_sources', [
      { value: 'instagram', createdAt: now, updatedAt: now },
      { value: 'tiktok', createdAt: now, updatedAt: now },
      { value: 'whatsapp', createdAt: now, updatedAt: now },
      { value: 'shopify', createdAt: now, updatedAt: now },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('online_order_sources');
  }
};
