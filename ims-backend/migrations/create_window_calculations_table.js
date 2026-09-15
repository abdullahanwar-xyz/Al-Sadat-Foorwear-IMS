const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('window_calculations', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      inputHeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      inputWidth: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      doorCount: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      aluminiumType: {
        type: DataTypes.ENUM('J', 'C'),
        allowNull: false
      },
      lockType: {
        type: DataTypes.ENUM('Push', 'Leach'),
        allowNull: false
      },
      finalHeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      finalWidths: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      heightDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      widthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      lockAddition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('window_calculations');
  }
};