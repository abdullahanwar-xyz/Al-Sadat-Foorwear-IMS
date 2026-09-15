'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add hasVentilator field
    await queryInterface.addColumn('window_calculations', 'hasVentilator', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add fixedAreaHeight field
    await queryInterface.addColumn('window_calculations', 'fixedAreaHeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });

    // Add usableHeight field
    await queryInterface.addColumn('window_calculations', 'usableHeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn('window_calculations', 'hasVentilator');
    await queryInterface.removeColumn('window_calculations', 'fixedAreaHeight');
    await queryInterface.removeColumn('window_calculations', 'usableHeight');
  }
};