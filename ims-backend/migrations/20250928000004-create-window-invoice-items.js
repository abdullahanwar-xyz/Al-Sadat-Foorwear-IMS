const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create window_invoice_items table
    await queryInterface.createTable('window_invoice_items', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      windowInvoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'window_invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      width: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      height: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      thickness: {
        type: DataTypes.ENUM('0.9mm', '1.2mm', '1.6mm', '2.0mm'),
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('C', 'J'),
        allowNull: false
      },
      totalFeed: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      finalFeed: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      feedRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      itemTotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      itemOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      description: {
        type: DataTypes.STRING
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('window_invoice_items', ['windowInvoiceId'], {
      name: 'window_invoice_items_window_invoice_id_index'
    });

    await queryInterface.addIndex('window_invoice_items', ['itemOrder'], {
      name: 'window_invoice_items_item_order_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('window_invoice_items');
  }
};