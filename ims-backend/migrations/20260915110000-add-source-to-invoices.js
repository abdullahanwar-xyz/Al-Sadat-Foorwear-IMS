const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('invoices', 'source', {
      type: DataTypes.ENUM('instagram', 'tiktok', 'whatsapp', 'shopify'),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('invoices', 'source');
  }
};
