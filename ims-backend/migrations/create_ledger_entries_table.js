const { sequelize } = require('../config/db');

module.exports = async function createLedgerEntriesTable() {
  const queryInterface = sequelize.getQueryInterface();
  
  console.log('Creating ledger_entries table...');
  
  try {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (tables.includes('ledger_entries')) {
      console.log('✓ ledger_entries table already exists');
      return;
    }

    await queryInterface.createTable('ledger_entries', {
      ledger_id: {
        type: sequelize.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ledger_type: {
        type: sequelize.Sequelize.ENUM('company', 'supplier', 'bank', 'cash'),
        allowNull: false
      },
      reference_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID of the company, supplier, or bank account'
      },
      entry_type: {
        type: sequelize.Sequelize.ENUM('transaction', 'invoice', 'expense', 'cash_flow', 'payment', 'adjustment'),
        allowNull: false
      },
      entry_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of the source entry'
      },
      transaction_date: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      },
      debit: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      credit: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      balance: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      description: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      reference_number: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      created_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for optimal query performance
    await queryInterface.addIndex('ledger_entries', ['ledger_type', 'reference_id'], {
      name: 'idx_ledger_type_ref'
    });
    
    await queryInterface.addIndex('ledger_entries', ['entry_type', 'entry_id'], {
      name: 'idx_ledger_entry'
    });
    
    await queryInterface.addIndex('ledger_entries', ['transaction_date'], {
      name: 'idx_ledger_date'
    });
    
    await queryInterface.addIndex('ledger_entries', ['ledger_type', 'reference_id', 'transaction_date'], {
      name: 'idx_ledger_composite'
    });

    console.log('✓ ledger_entries table created successfully');
  } catch (error) {
    console.error('Error creating ledger_entries table:', error.message);
    throw error;
  }
};
