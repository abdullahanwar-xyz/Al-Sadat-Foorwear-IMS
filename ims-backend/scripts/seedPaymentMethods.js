const sequelize = require('../config/db');
const PaymentMethod = require('../models/PaymentMethod');

async function seedPaymentMethods() {
  try {
    console.log('Starting payment methods seeding...');
    
    // Skip sync to avoid "too many keys" error
    // The table already exists from previous migrations
    // await PaymentMethod.sync({ alter: true });
    
    // Check if payment methods already exist
    const count = await PaymentMethod.count();
    
    if (count > 0) {
      console.log(`Payment methods already exist (${count} found). Skipping seed.`);
      return;
    }

    // Default payment methods
    const defaultMethods = [
      {
        name: 'Cash',
        value: 'cash',
        icon: 'Wallet',
        status: 1,
        displayOrder: 1,
      },
      {
        name: 'Card',
        value: 'card',
        icon: 'CreditCard',
        status: 1,
        displayOrder: 2,
      },
      {
        name: 'Bank Transfer',
        value: 'bank_transfer',
        icon: 'Landmark',
        status: 1,
        displayOrder: 3,
        requiresBankAccount: true,
      },
      {
        name: 'Check',
        value: 'check',
        icon: 'DollarSign',
        status: 1,
        displayOrder: 4,
      },
      {
        name: 'Easypaisa',
        value: 'easypaisa',
        icon: 'Smartphone',
        status: 1,
        displayOrder: 5,
      },
      {
        name: 'JazzCash',
        value: 'jazzcash',
        icon: 'Wallet',
        status: 1,
        displayOrder: 6,
      },
    ];

    await PaymentMethod.bulkCreate(defaultMethods);
    console.log(`✓ Successfully seeded ${defaultMethods.length} payment methods`);
    
  } catch (error) {
    console.error('Error seeding payment methods:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedPaymentMethods()
    .then(() => {
      console.log('Payment methods seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Payment methods seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedPaymentMethods;
