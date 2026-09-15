const Customer = require('../models/Customer');

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

async function seedWalkInCustomer() {
  try {
    const existing = await Customer.findOne({ where: { name: WALK_IN_CUSTOMER_NAME } });

    if (existing) {
      console.log(`Walk-in Customer already exists (id ${existing.id}). Skipping seed.`);
      return existing;
    }

    const created = await Customer.create({ name: WALK_IN_CUSTOMER_NAME });
    console.log(`✓ Created default Walk-in Customer (id ${created.id})`);
    return created;
  } catch (error) {
    console.error('Error seeding Walk-in Customer:', error);
    throw error;
  }
}

if (require.main === module) {
  seedWalkInCustomer()
    .then(() => {
      console.log('Walk-in Customer seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Walk-in Customer seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedWalkInCustomer;
