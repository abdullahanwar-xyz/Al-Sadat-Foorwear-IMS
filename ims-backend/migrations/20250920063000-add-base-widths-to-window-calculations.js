'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('window_calculations', 'baseWidths', {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: '[]' // Default to empty array
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('window_calculations', 'baseWidths');
  }
};