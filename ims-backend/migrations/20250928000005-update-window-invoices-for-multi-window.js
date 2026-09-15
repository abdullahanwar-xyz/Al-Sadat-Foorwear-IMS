const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove single window fields from window_invoices table
    await queryInterface.removeColumn('window_invoices', 'width');
    await queryInterface.removeColumn('window_invoices', 'height');
    await queryInterface.removeColumn('window_invoices', 'quantity');
    await queryInterface.removeColumn('window_invoices', 'thickness');
    await queryInterface.removeColumn('window_invoices', 'type');
    await queryInterface.removeColumn('window_invoices', 'totalFeed');
    await queryInterface.removeColumn('window_invoices', 'finalFeed');
    await queryInterface.removeColumn('window_invoices', 'feedRate');

    // Add new fields for multi-window support with discount
    await queryInterface.addColumn('window_invoices', 'subtotalAmount', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    await queryInterface.addColumn('window_invoices', 'discountPercentage', {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    });

    await queryInterface.addColumn('window_invoices', 'discountAmount', {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove new discount fields
    await queryInterface.removeColumn('window_invoices', 'subtotalAmount');
    await queryInterface.removeColumn('window_invoices', 'discountPercentage');
    await queryInterface.removeColumn('window_invoices', 'discountAmount');

    // Add back single window fields
    await queryInterface.addColumn('window_invoices', 'width', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'height', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'quantity', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.addColumn('window_invoices', 'thickness', {
      type: DataTypes.ENUM('0.9mm', '1.2mm', '1.6mm', '2.0mm'),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'type', {
      type: DataTypes.ENUM('C', 'J'),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'totalFeed', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'finalFeed', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    });

    await queryInterface.addColumn('window_invoices', 'feedRate', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    });
  }
};