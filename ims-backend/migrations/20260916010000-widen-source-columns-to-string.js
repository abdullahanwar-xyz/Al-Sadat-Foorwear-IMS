const { DataTypes } = require('sequelize');

// Source moves from a fixed ENUM to a manageable list (OnlineOrderSource) -
// these two columns need to accept any string value now, not just the
// original four.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn('online_orders', 'source', {
      type: DataTypes.STRING(50),
      allowNull: false,
    });
    await queryInterface.changeColumn('invoices', 'source', {
      type: DataTypes.STRING(50),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.changeColumn('online_orders', 'source', {
      type: DataTypes.ENUM('instagram', 'tiktok', 'whatsapp', 'shopify'),
      allowNull: false,
    });
    await queryInterface.changeColumn('invoices', 'source', {
      type: DataTypes.ENUM('instagram', 'tiktok', 'whatsapp', 'shopify'),
      allowNull: true,
    });
  }
};
