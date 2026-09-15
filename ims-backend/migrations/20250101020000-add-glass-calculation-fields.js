const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add glass calculation settings to window_settings table
    await queryInterface.addColumn('window_settings', 'glassWidthSutureValue', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0
    });

    await queryInterface.addColumn('window_settings', 'glassHeightSutureValue', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0
    });

    await queryInterface.addColumn('window_settings', 'glassHeightDeduction', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 4.0
    });

    // Add glass dimensions to window_calculations table
    await queryInterface.addColumn('window_calculations', 'glassWidth', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('window_calculations', 'glassHeight', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });

    console.log('✅ Glass calculation fields added successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove glass calculation fields
    await queryInterface.removeColumn('window_settings', 'glassWidthSutureValue');
    await queryInterface.removeColumn('window_settings', 'glassHeightSutureValue');
    await queryInterface.removeColumn('window_settings', 'glassHeightDeduction');
    await queryInterface.removeColumn('window_calculations', 'glassWidth');
    await queryInterface.removeColumn('window_calculations', 'glassHeight');

    console.log('✅ Glass calculation fields removed successfully');
  }
};