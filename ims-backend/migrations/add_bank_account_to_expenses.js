const { sequelize } = require('../config/db');

async function addBankAccountToExpenses() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('expenses');
    
    if (!tableDescription.bank_account_id) {
      console.log('Adding bank_account_id column to expenses table...');
      
      await queryInterface.addColumn('expenses', 'bank_account_id', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bank_accounts',
          key: 'account_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      
      console.log('✓ bank_account_id column added to expenses table');
    } else {
      console.log('✓ bank_account_id column already exists in expenses table');
    }
  } catch (error) {
    console.error('Error adding bank_account_id to expenses:', error);
    throw error;
  }
}

module.exports = { addBankAccountToExpenses };
