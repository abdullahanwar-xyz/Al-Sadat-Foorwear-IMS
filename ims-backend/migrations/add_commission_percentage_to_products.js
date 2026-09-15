const { sequelize } = require('../config/db');

async function addCommissionPercentageColumn() {
  try {
    console.log('Adding commission_percentage column to products table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'commission_percentage'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ commission_percentage column already exists');
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE products 
      ADD COLUMN commission_percentage DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Commission percentage that company gives for this product'
    `);
    
    console.log('✓ Successfully added commission_percentage column to products table');
  } catch (error) {
    console.error('Error adding commission_percentage column:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addCommissionPercentageColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCommissionPercentageColumn;
