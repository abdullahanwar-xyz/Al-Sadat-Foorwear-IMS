const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('window_settings', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      jTypeHeightDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 6.3
      },
      cTypeHeightDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 4.4
      },
      jType2DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 17.5
      },
      cType2DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 15.5
      },
      jType3DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 21.8
      },
      cType3DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 20.0
      },
      jType4DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 31.3
      },
      cType4DoorWidthDeduction: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 29.3
      },
      pushLockAddition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 5.5
      },
      leachLockAddition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 8.8
      },
      threeDoorPanel1Addition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 7.0
      },
      threeDoorPanel2Addition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 14.0
      },
      threeDoorFixedWidth: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 172.3
      },
      fourDoorFixedWidth: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 172.3
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      version: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '1.0'
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

    // Insert default settings
    await queryInterface.bulkInsert('window_settings', [{
      jTypeHeightDeduction: 6.3,
      cTypeHeightDeduction: 4.4,
      jType2DoorWidthDeduction: 17.5,
      cType2DoorWidthDeduction: 15.5,
      jType3DoorWidthDeduction: 21.8,
      cType3DoorWidthDeduction: 20.0,
      jType4DoorWidthDeduction: 31.3,
      cType4DoorWidthDeduction: 29.3,
      pushLockAddition: 5.5,
      leachLockAddition: 8.8,
      threeDoorPanel1Addition: 7.0,
      threeDoorPanel2Addition: 14.0,
      threeDoorFixedWidth: 172.3,
      fourDoorFixedWidth: 172.3,
      isActive: true,
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('window_settings');
  }
};