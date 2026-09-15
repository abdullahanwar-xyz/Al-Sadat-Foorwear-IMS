// Removes the tables backing features that were nav-hidden, unused, and
// removed from the codebase in this cleanup pass: Estimates, Gate Passes,
// Window Invoices, Window Invoice Settings, Window Calculator, and the
// legacy Return Adjustments system (fully superseded by the single-invoice
// Return/Exchange model - see Return/ReturnItem/Refund). Dropped in
// child-before-parent order to satisfy existing foreign key constraints.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('return_adjustment_items');
    await queryInterface.dropTable('return_adjustments');
    await queryInterface.dropTable('gate_passes');
    await queryInterface.dropTable('estimate_items');
    await queryInterface.dropTable('estimates');
    await queryInterface.dropTable('window_invoice_items');
    await queryInterface.dropTable('window_invoice_payments');
    await queryInterface.dropTable('window_invoices');
    await queryInterface.dropTable('window_invoice_settings');
    await queryInterface.dropTable('window_calculations');
    await queryInterface.dropTable('window_settings');
  },
  down: async (queryInterface, Sequelize) => {
    // Not reversible - the tables' full column definitions lived in the
    // deleted model files, not here. Restore from a backup if needed.
    throw new Error('This migration is not reversible. Restore the dropped tables from a database backup.');
  },
};
