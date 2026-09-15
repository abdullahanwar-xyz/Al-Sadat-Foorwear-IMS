const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'collection', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Al Sadat'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'collection');
  }
};
