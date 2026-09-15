const { sequelize } = require('../config/db');
const BankAccount = require('../models/BankAccount');

async function createDefaultCashAccount() {
  try {
    // Check if Shop Cash Register already exists
    const existingCashAccount = await BankAccount.findOne({
      where: {
        account_name: 'Shop Cash Register',
        account_type: 'cash',
        company_id: null
      }
    });

    if (!existingCashAccount) {
      console.log('Creating default Shop Cash Register account...');
      
      const cashAccount = await BankAccount.create({
        account_name: 'Shop Cash Register',
        account_type: 'cash',
        bank_name: null,
        account_number: 'CASH-001',
        branch: null,
        opening_balance: 0,
        current_balance: 0,
        currency: 'PKR',
        description: 'Default cash account for all cash payments (invoices, expenses, transactions)',
        status: 1, // Active
        company_id: null, // Shop's personal account
        created_by: 1 // System/Admin
      });
      
      console.log('✓ Shop Cash Register account created successfully (ID:', cashAccount.account_id, ')');
    } else {
      console.log('✓ Shop Cash Register account already exists (ID:', existingCashAccount.account_id, ')');
    }
  } catch (error) {
    console.error('Error creating default cash account:', error);
    throw error;
  }
}

module.exports = createDefaultCashAccount;
