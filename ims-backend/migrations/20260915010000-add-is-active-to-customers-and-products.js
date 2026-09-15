const { DataTypes } = require('sequelize');

// Customers and Products currently only support hard delete (Customer
// unconditionally cascades through Payments/InvoiceItems/Invoices;
// Product blocks by default but has a force=true cascade bypass). Neither
// has a way to retire a record that has real history without destroying
// that history. is_active gives both a simple archive path: hide it from
// active use without deleting anything.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('customers', 'is_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('products', 'is_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'is_active');
    await queryInterface.removeColumn('customers', 'is_active');
  },
};
