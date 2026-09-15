const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create window_invoice_payments table
    await queryInterface.createTable('window_invoice_payments', {
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
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE')
      },
      paymentMethod: {
        type: DataTypes.ENUM('cash', 'check', 'bank_transfer', 'card', 'other'),
        allowNull: false,
        defaultValue: 'cash'
      },
      reference: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.TEXT
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
    await queryInterface.addIndex('window_invoice_payments', ['windowInvoiceId'], {
      name: 'window_invoice_payments_window_invoice_id_index'
    });

    await queryInterface.addIndex('window_invoice_payments', ['paymentDate'], {
      name: 'window_invoice_payments_payment_date_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('window_invoice_payments');
  }
};