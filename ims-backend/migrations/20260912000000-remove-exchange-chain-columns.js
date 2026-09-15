// Single-invoice Return/Exchange redesign: exchanges no longer create a new
// Invoice, so the columns that supported the old chain (previousInvoiceId +
// exchangeNote on invoices, newInvoiceId on returns) are dead. History is
// now computed from Return/ReturnItem/Refund/Payment, not stored text.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('invoices', 'previousInvoiceId');
    await queryInterface.removeColumn('invoices', 'exchangeNote');
    await queryInterface.removeColumn('returns', 'newInvoiceId');
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invoices', 'previousInvoiceId', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('invoices', 'exchangeNote', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('returns', 'newInvoiceId', { type: Sequelize.INTEGER, allowNull: true });
  },
};
