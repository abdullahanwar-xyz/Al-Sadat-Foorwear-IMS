const { sequelize } = require('../config/db');

async function addBankAccountToPayments() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    console.log('Adding bank_account_id column to payments table...');
    
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('payments');
    
    if (tableDescription.bank_account_id) {
      console.log('✓ bank_account_id column already exists');
      return;
    }
    
    // Add bank_account_id column
    await queryInterface.addColumn('payments', 'bank_account_id', {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'account_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    
    console.log('✓ bank_account_id column added to payments table');
    
  } catch (error) {
    console.error('Error adding bank_account_id to payments:', error);
    throw error;
  }
}

module.exports = { addBankAccountToPayments };
