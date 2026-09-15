const { sequelize } = require('../config/db');

async function addReferenceColumn() {
  try {
    console.log('Checking for reference column in payments table...');
    
    // For SQLite, we use this approach to check if column exists
    const [results] = await sequelize.query(`PRAGMA table_info(payments)`);
    const columnExists = results.some(column => column.name === 'reference');
    
    if (!columnExists) {
      console.log('Adding reference column to payments table...');
      // SQLite syntax for adding column
      await sequelize.query(`ALTER TABLE payments ADD COLUMN reference TEXT;`);
      console.log('Column added successfully.');
    } else {
      console.log('Reference column already exists.');
    }
  } catch (error) {
    console.error('Error details:', error.message);
    if (error.original) {
      console.error('Original error:', error.original);
    }
  } finally {
    console.log('Database operation completed.');
    await sequelize.close();
  }
}

// Execute immediately when script is run
addReferenceColumn().then(() => {
  console.log('Script execution completed.');
}).catch(err => {
  console.error('Failed to execute script:', err);
  process.exit(1);
});
