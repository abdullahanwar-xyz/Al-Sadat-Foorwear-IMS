const { DataTypes } = require('sequelize');

// Adds the flag that drives whether a payment method's checkout UI must
// collect a bank account (only Bank Transfer, today), and renames the two
// generic-sounding methods to the actual mobile wallets used in Pakistan.
// Safe to run against real data: no payments/refunds table row currently
// uses 'upi' or 'mobile_wallet' as its method (verified beforehand), so
// this is a pure rename with nothing to backfill.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payment_methods', 'requiresBankAccount', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.bulkUpdate(
      'payment_methods',
      { requiresBankAccount: true },
      { value: 'bank_transfer' }
    );

    await queryInterface.bulkUpdate(
      'payment_methods',
      { name: 'Easypaisa', value: 'easypaisa' },
      { value: 'upi' }
    );

    await queryInterface.bulkUpdate(
      'payment_methods',
      { name: 'JazzCash', value: 'jazzcash' },
      { value: 'mobile_wallet' }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkUpdate(
      'payment_methods',
      { name: 'UPI', value: 'upi' },
      { value: 'easypaisa' }
    );
    await queryInterface.bulkUpdate(
      'payment_methods',
      { name: 'Mobile Wallet', value: 'mobile_wallet' },
      { value: 'jazzcash' }
    );
    await queryInterface.removeColumn('payment_methods', 'requiresBankAccount');
  },
};
