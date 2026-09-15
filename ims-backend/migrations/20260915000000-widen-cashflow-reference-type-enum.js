const { DataTypes } = require('sequelize');

// cash_flows.reference_type is a MySQL ENUM that never got widened as new
// reference types were introduced in code: invoiceController's
// reversePayments/reverseRefunds write 'invoice', and
// supplierTransactionController writes 'supplier_transaction', but neither
// value is in the column's actual enum('company_transaction',
// 'supplier_invoice','expense','manual','other'). Because this DB's
// sql_mode doesn't include STRICT_TRANS_TABLES, MySQL doesn't reject an
// out-of-enum value - it silently stores '' instead, with no error. That's
// been quietly corrupting the audit trail on every invoice-payment
// reversal and every supplier-transaction cash flow entry (verified live:
// several existing rows already have reference_type = ''). This adds the
// two missing values so future writes store the real value instead of
// silently losing it. Deliberately additive only - existing rows already
// written as '' are left as-is (there's no reliable way to know which of
// 'invoice' or 'supplier_transaction' each one was meant to be from the
// empty string alone), and no existing enum value is removed.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn('cash_flows', 'reference_type', {
      type: DataTypes.ENUM(
        'company_transaction',
        'supplier_invoice',
        'expense',
        'manual',
        'other',
        'invoice',
        'supplier_transaction'
      ),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.changeColumn('cash_flows', 'reference_type', {
      type: DataTypes.ENUM(
        'company_transaction',
        'supplier_invoice',
        'expense',
        'manual',
        'other'
      ),
      allowNull: true,
    });
  },
};
