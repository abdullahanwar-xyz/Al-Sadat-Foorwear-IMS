const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create window_invoices table
    await queryInterface.createTable('window_invoices', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE')
      },
      width: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      height: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      totalFeed: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      finalFeed: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      thickness: {
        type: DataTypes.ENUM('0.9mm', '1.2mm', '1.6mm', '2.0mm'),
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('C', 'J'),
        allowNull: false
      },
      feedRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      remainingAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'partial', 'paid'),
        defaultValue: 'pending'
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
    await queryInterface.addIndex('window_invoices', ['customerId'], {
      name: 'window_invoices_customer_id_index'
    });

    await queryInterface.addIndex('window_invoices', ['invoiceNumber'], {
      unique: true,
      name: 'window_invoices_invoice_number_unique'
    });

    await queryInterface.addIndex('window_invoices', ['date'], {
      name: 'window_invoices_date_index'
    });

    await queryInterface.addIndex('window_invoices', ['status'], {
      name: 'window_invoices_status_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('window_invoices');
  }
};