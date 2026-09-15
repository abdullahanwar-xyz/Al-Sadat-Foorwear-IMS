const { sequelize } = require('../config/db');

module.exports = async function createBankAccountsTable() {
  const queryInterface = sequelize.getQueryInterface();
  
  console.log('Creating bank_accounts table...');
  
  try {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (tables.includes('bank_accounts')) {
      console.log('✓ bank_accounts table already exists');
      return;
    }

    // Create table without foreign keys first
    await queryInterface.createTable('bank_accounts', {
      account_id: {
        type: sequelize.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      company_id: {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true
      },
      account_name: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: false
      },
      account_number: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      bank_name: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      account_type: {
        type: sequelize.Sequelize.ENUM('bank', 'cash'),
        allowNull: false,
        defaultValue: 'bank'
      },
      opening_balance: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      current_balance: {
        type: sequelize.Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      currency: {
        type: sequelize.Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'PKR'
      },
      branch: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      ifsc_code: {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      },
      description: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: sequelize.Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '1 = Active, 0 = Inactive'
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
        ALTER TABLE bank_accounts
        ADD CONSTRAINT fk_bank_accounts_company
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE
      `);
    } catch (error) {
      console.log('Warning: Could not add company foreign key:', error.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE bank_accounts
        ADD CONSTRAINT fk_bank_accounts_user
        FOREIGN KEY (created_by) REFERENCES users(user_id)
      `);
    } catch (error) {
      console.log('Warning: Could not add user foreign key:', error.message);
    }

    // Add indexes
    await queryInterface.addIndex('bank_accounts', ['company_id'], {
      name: 'idx_bank_accounts_company'
    });
    
    await queryInterface.addIndex('bank_accounts', ['account_type'], {
      name: 'idx_bank_accounts_type'
    });
    
    await queryInterface.addIndex('bank_accounts', ['status'], {
      name: 'idx_bank_accounts_status'
    });

    console.log('✓ bank_accounts table created successfully');
  } catch (error) {
    console.error('Error creating bank_accounts table:', error.message);
    throw error;
  }
};
