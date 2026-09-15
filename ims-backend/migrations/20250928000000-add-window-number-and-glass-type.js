'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add window_number column
    await queryInterface.addColumn('window_calculations', 'window_number', {
      type: Sequelize.STRING,
      allowNull: true, // Allow null for existing records
      defaultValue: null
    });

    // Add glass_type column
    await queryInterface.addColumn('window_calculations', 'glass_type', {
      type: Sequelize.ENUM('S', 'F', 'P'),
      allowNull: true, // Allow null for existing records
      defaultValue: null
    });

    // Add session_id to group multiple windows together
    await queryInterface.addColumn('window_calculations', 'session_id', {
      type: Sequelize.STRING,
      allowNull: true, // Allow null for existing records
      defaultValue: null
    });

    // Add index for session_id for better query performance
    await queryInterface.addIndex('window_calculations', ['session_id']);
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('window_calculations', ['session_id']);
    
    // Remove columns
    await queryInterface.removeColumn('window_calculations', 'session_id');
    await queryInterface.removeColumn('window_calculations', 'glass_type');
    await queryInterface.removeColumn('window_calculations', 'window_number');
  }
};