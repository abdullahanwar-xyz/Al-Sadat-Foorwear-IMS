const BankAccount = require('../models/BankAccount');

/**
 * Get or create the default "Shop Cash Register" account
 * This account is used for all cash payments from invoices
 */
async function getOrCreateDefaultCashAccount(userId) {
  try {
    // Try to find existing default cash account
    let cashAccount = await BankAccount.findOne({
      where: {
        account_name: 'Shop Cash Register',
        account_type: 'cash'
      }
    });

    // If doesn't exist, create it
    if (!cashAccount) {
      console.log('Creating default Shop Cash Register account...');
      
      cashAccount = await BankAccount.create({
        account_name: 'Shop Cash Register',
        account_type: 'cash',
        opening_balance: 0,
        current_balance: 0,
        currency: 'PKR',
        description: 'Default cash account for shop invoice payments',
        status: 1,
        created_by: userId
      });
      
      console.log('✓ Default Shop Cash Register account created:', cashAccount.account_id);
    }

    return cashAccount;
  } catch (error) {
    console.error('Error getting/creating default cash account:', error);
    throw error;
  }
}

module.exports = { getOrCreateDefaultCashAccount };
