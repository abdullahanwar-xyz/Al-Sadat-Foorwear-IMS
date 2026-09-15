const { DataTypes } = require('sequelize');

// Removes the Companies concept entirely and redesigns the Transactions
// section into a supplier purchase/restock ledger. Verified beforehand:
// companies, suppliers, company_transactions, and ledger_entries are all
// empty (0 rows) - this is schema-only, nothing to migrate or lose. The 2
// real bank_accounts rows are untouched, only losing their (always-null)
// company_id column.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the tables that depended on companies first.
    await queryInterface.dropTable('company_transactions');
    await queryInterface.dropTable('ledger_entries');

    // Drop the real FK constraints before removing their columns - MySQL
    // won't drop a column that a foreign key still references.
    await queryInterface.removeConstraint('suppliers', 'suppliers_ibfk_1');
    await queryInterface.removeConstraint('expenses', 'expenses_ibfk_1');
    await queryInterface.removeConstraint('bank_accounts', 'bank_accounts_ibfk_1');
    await queryInterface.removeConstraint('supplier_invoices', 'supplier_invoices_ibfk_2');

    // Drop company_id from every table that referenced companies.
    await queryInterface.removeColumn('suppliers', 'company_id');
    await queryInterface.removeColumn('expenses', 'company_id');
    await queryInterface.removeColumn('bank_accounts', 'company_id');
    await queryInterface.removeColumn('supplier_invoices', 'company_id');

    await queryInterface.dropTable('companies');

    // New supplier purchase/restock ledger.
    await queryInterface.createTable('supplier_transactions', {
      trans_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      supplier_id: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.ENUM('purchase', 'payment'), allowNull: false },
      total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      amount_paid: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      description: { type: DataTypes.TEXT, allowNull: true },
      payment_method: { type: DataTypes.STRING(50), allowNull: true },
      bank_account_id: { type: DataTypes.INTEGER, allowNull: true },
      reference_number: { type: DataTypes.STRING(100), allowNull: true },
      transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('supplier_transaction_items', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      supplier_transaction_id: { type: DataTypes.INTEGER, allowNull: false },
      product_color_rate_id: { type: DataTypes.INTEGER, allowNull: false },
      size: { type: DataTypes.FLOAT, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      unit_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      line_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('supplier_transactions', ['supplier_id']);
    await queryInterface.addIndex('supplier_transactions', ['type']);
    await queryInterface.addIndex('supplier_transactions', ['transaction_date']);
    await queryInterface.addIndex('supplier_transaction_items', ['supplier_transaction_id']);
    await queryInterface.addIndex('supplier_transaction_items', ['product_color_rate_id']);
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('This migration is not reversible. Restore from a database backup if needed.');
  },
};
