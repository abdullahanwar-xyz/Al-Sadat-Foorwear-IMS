const { sequelize } = require('../config/db');

async function addBankAccountToCompanyTransactions() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('company_transactions');
    
    if (!tableDescription.bank_account_id) {
      console.log('Adding bank_account_id column to company_transactions table...');
      
      await queryInterface.addColumn('company_transactions', 'bank_account_id', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bank_accounts',
          key: 'account_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      
      console.log('✓ bank_account_id column added to company_transactions table');
    } else {
      console.log('✓ bank_account_id column already exists in company_transactions table');
    }
  } catch (error) {
    console.error('Error adding bank_account_id to company_transactions:', error);
    throw error;
  }
}

module.exports = { addBankAccountToCompanyTransactions };
