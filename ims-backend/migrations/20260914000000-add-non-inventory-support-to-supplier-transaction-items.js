const { DataTypes } = require('sequelize');

// Lets a purchase transaction include supplier-sold items that aren't
// finished-shoe inventory (leather, laces, soles, etc.) alongside real
// stock items. is_inventory_item distinguishes the two; product_color_rate_id
// and size become optional (only meaningful for inventory lines), and
// description carries the free-text label for non-inventory lines.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('supplier_transaction_items', 'is_inventory_item', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('supplier_transaction_items', 'description', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });

    await queryInterface.changeColumn('supplier_transaction_items', 'product_color_rate_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });

    await queryInterface.changeColumn('supplier_transaction_items', 'size', {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.changeColumn('supplier_transaction_items', 'size', {
      type: DataTypes.FLOAT,
      allowNull: false,
    });

    await queryInterface.changeColumn('supplier_transaction_items', 'product_color_rate_id', {
      type: DataTypes.INTEGER,
      allowNull: false,
    });

    await queryInterface.removeColumn('supplier_transaction_items', 'description');
    await queryInterface.removeColumn('supplier_transaction_items', 'is_inventory_item');
  },
};
