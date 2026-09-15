const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add the order column to invoice_items table
      await queryInterface.addColumn('invoice_items', 'order', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      });

      console.log('Order column added successfully to invoice_items table');
    } catch (error) {
      console.error('Error adding order column:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove the order column
      await queryInterface.removeColumn('invoice_items', 'order');
      console.log('Order column removed from invoice_items table');
    } catch (error) {
      console.error('Error removing order column:', error);
      throw error;
    }
  }
};
