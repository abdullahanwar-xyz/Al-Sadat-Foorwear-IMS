const { sequelize } = require('../config/db');

module.exports = async function createCashFlowsTable() {
  const queryInterface = sequelize.getQueryInterface();
  
  console.log('Creating cash_flows table...');
  
  try {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (tables.includes('cash_flows')) {
      console.log('✓ cash_flows table already exists');
      return;
    }

    // Create table without foreign keys first
    await queryInterface.createTable('cash_flows', {
      flow_id: {
        type: sequelize.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      account_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: false
      },
      transaction_type: {
        type: sequelize.Sequelize.ENUM('deposit', 'withdrawal', 'transfer_in', 'transfer_out'),
        allowNull: false
      },
      amount: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      related_account_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        comment: 'For transfers, the other account involved'
      },
      reference_type: {
        type: sequelize.Sequelize.ENUM('company_transaction', 'supplier_invoice', 'expense', 'manual', 'other'),
        allowNull: true
      },
      reference_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of the related transaction/invoice/expense'
      },
      reference_number: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      payment_method: {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      },
      description: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      transaction_date: {
        type: sequelize.Sequelize.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      balance_before: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      balance_after: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      created_by: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add foreign key constraints
    try {
      await sequelize.query(`
        ALTER TABLE cash_flows
        ADD CONSTRAINT fk_cash_flows_account
        FOREIGN KEY (account_id) REFERENCES bank_accounts(account_id) ON DELETE CASCADE
      `);
    } catch (error) {
      console.log('Warning: Could not add account foreign key:', error.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE cash_flows
        ADD CONSTRAINT fk_cash_flows_related_account
        FOREIGN KEY (related_account_id) REFERENCES bank_accounts(account_id)
      `);
    } catch (error) {
      console.log('Warning: Could not add related_account foreign key:', error.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE cash_flows
        ADD CONSTRAINT fk_cash_flows_user
        FOREIGN KEY (created_by) REFERENCES users(user_id)
      `);
    } catch (error) {
      console.log('Warning: Could not add user foreign key:', error.message);
    }

    // Add indexes for better query performance
    await queryInterface.addIndex('cash_flows', ['account_id'], {
      name: 'idx_cash_flows_account'
    });
    
    await queryInterface.addIndex('cash_flows', ['transaction_date'], {
      name: 'idx_cash_flows_date'
    });
    
    await queryInterface.addIndex('cash_flows', ['transaction_type'], {
      name: 'idx_cash_flows_type'
    });
    
    await queryInterface.addIndex('cash_flows', ['reference_type', 'reference_id'], {
      name: 'idx_cash_flows_reference'
    });

    console.log('✓ cash_flows table created successfully');
  } catch (error) {
    console.error('Error creating cash_flows table:', error.message);
    throw error;
  }
};
