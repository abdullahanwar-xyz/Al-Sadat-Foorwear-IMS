const { DataTypes } = require('sequelize');

// Adds 'wallet' alongside 'bank'/'cash' so JazzCash/Easypaisa can be
// tracked as their own real accounts instead of silently settling into the
// default cash register. Additive only - existing 'bank'/'cash' rows are
// untouched.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn('bank_accounts', 'account_type', {
      type: DataTypes.ENUM('bank', 'cash', 'wallet'),
      allowNull: false,
      defaultValue: 'bank',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.changeColumn('bank_accounts', 'account_type', {
      type: DataTypes.ENUM('bank', 'cash'),
      allowNull: false,
      defaultValue: 'bank',
    });
  }
};
