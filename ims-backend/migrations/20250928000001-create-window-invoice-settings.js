const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create window_invoice_settings table
    await queryInterface.createTable('window_invoice_settings', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      thickness: {
        type: DataTypes.ENUM('0.9mm', '1.2mm', '1.6mm', '2.0mm'),
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('C', 'J'),
        allowNull: false
      },
      feedRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique index for thickness and type combination
    await queryInterface.addIndex('window_invoice_settings', ['thickness', 'type'], {
      unique: true,
      name: 'window_invoice_settings_thickness_type_unique'
    });

    // Insert default feed rates
    const defaultRates = [
      { thickness: '0.9mm', type: 'C', feedRate: 5.50, isActive: true },
      { thickness: '0.9mm', type: 'J', feedRate: 6.00, isActive: true },
      { thickness: '1.2mm', type: 'C', feedRate: 7.25, isActive: true },
      { thickness: '1.2mm', type: 'J', feedRate: 7.75, isActive: true },
      { thickness: '1.6mm', type: 'C', feedRate: 9.00, isActive: true },
      { thickness: '1.6mm', type: 'J', feedRate: 9.50, isActive: true },
      { thickness: '2.0mm', type: 'C', feedRate: 11.75, isActive: true },
      { thickness: '2.0mm', type: 'J', feedRate: 12.25, isActive: true }
    ];

    const now = new Date();
    const formattedRates = defaultRates.map(rate => ({
      ...rate,
      createdAt: now,
      updatedAt: now
    }));

    await queryInterface.bulkInsert('window_invoice_settings', formattedRates);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('window_invoice_settings');
  }
};