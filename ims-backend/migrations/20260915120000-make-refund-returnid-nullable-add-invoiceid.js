const { DataTypes } = require('sequelize');

// Generalizes refunds beyond product Returns: an Online Order cancellation
// refund isn't tied to any returned product, so it needs its own anchor.
// returnId becomes nullable and a new nullable invoiceId is added - exactly
// one of the two is populated per row (enforced in
// paymentService.recordRefund, not here). Existing rows (all product-return
// refunds) are untouched - they keep their returnId, invoiceId stays null.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn('refunds', 'returnId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('refunds', 'invoiceId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('refunds', 'invoiceId');
    await queryInterface.changeColumn('refunds', 'returnId', {
      type: DataTypes.INTEGER,
      allowNull: false,
    });
  }
};
