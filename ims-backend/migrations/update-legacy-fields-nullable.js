const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Making legacy fields nullable for array-based calculations...');
    
    try {
      // Make legacy individual window fields nullable
      await queryInterface.changeColumn('window_calculations', 'inputHeight', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'inputWidth', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'productType', {
        type: DataTypes.ENUM('Window', 'Ventilator'),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'doorCount', {
        type: DataTypes.INTEGER,
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'aluminiumType', {
        type: DataTypes.ENUM('J', 'C'),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'lockType', {
        type: DataTypes.ENUM('Push', 'Leach'),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'finalHeight', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'usableHeight', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'finalWidths', {
        type: DataTypes.TEXT,
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'baseWidths', {
        type: DataTypes.TEXT,
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'heightDeduction', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'widthDeduction', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      await queryInterface.changeColumn('window_calculations', 'lockAddition', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });

      console.log('✅ Legacy fields successfully made nullable');
    } catch (error) {
      console.error('Error making legacy fields nullable:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Reverting legacy fields to NOT NULL...');
    
    // Note: This down migration might fail if there are null values
    // Consider adding default values or cleaning data before reverting
    
    try {
      await queryInterface.changeColumn('window_calculations', 'inputHeight', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      });

      await queryInterface.changeColumn('window_calculations', 'inputWidth', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      });

      // Add other fields as needed...
      console.log('✅ Legacy fields reverted to NOT NULL');
    } catch (error) {
      console.error('Error reverting legacy fields:', error);
      throw error;
    }
  }
};