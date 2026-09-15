const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create estimates table
    await queryInterface.createTable('estimates', {
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
        onDelete: 'CASCADE'
      },
      estimateNumber: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      company: {
        type: DataTypes.STRING,
        allowNull: true
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      grossAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      discount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
      },
      taxAmount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
      },
      netAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'draft'
      },
      validUntil: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create estimate_items table
    await queryInterface.createTable('estimate_items', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      estimateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'estimates',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productColorRateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'product_color_rates',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true
      },
      size: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      quantity: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      rate: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      total: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      totalFeet: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      grossValue: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      discount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
      },
      netValue: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('estimates', ['customerId']);
    await queryInterface.addIndex('estimates', ['estimateNumber']);
    await queryInterface.addIndex('estimates', ['status']);
    await queryInterface.addIndex('estimates', ['date']);
    
    await queryInterface.addIndex('estimate_items', ['estimateId']);
    await queryInterface.addIndex('estimate_items', ['productId']);
    await queryInterface.addIndex('estimate_items', ['productColorRateId']);
    await queryInterface.addIndex('estimate_items', ['order']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('estimate_items');
    await queryInterface.dropTable('estimates');
  }
};