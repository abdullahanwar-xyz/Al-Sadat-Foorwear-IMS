const { sequelize } = require('../config/db');

module.exports = async function fixWindowInvoicesNotNullConstraints() {
  try {
    console.log('Fixing window_invoices not null constraints...');

    // Check if the table exists
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'window_invoices'
    `);

    if (tables.length === 0) {
      console.log('window_invoices table does not exist, skipping migration');
      return;
    }

    // Get existing columns to check current schema
    const [results] = await sequelize.query(`SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'window_invoices'`);
    const existingColumns = results.map(col => ({ name: col.name, type: col.type, notnull: col.IS_NULLABLE === 'NO', dflt_value: col.COLUMN_DEFAULT }));
    console.log('Current window_invoices columns:', existingColumns);

    // Update any existing records that might have null values
    await sequelize.query(`
      UPDATE window_invoices 
      SET totalAmount = COALESCE(totalAmount, subtotalAmount - COALESCE(discountAmount, 0), 0)
      WHERE totalAmount IS NULL
    `);

    await sequelize.query(`
      UPDATE window_invoices 
      SET remainingAmount = COALESCE(remainingAmount, totalAmount - COALESCE(paidAmount, 0), 0)
      WHERE remainingAmount IS NULL
    `);

    console.log('✅ Fixed any existing null values in window_invoices table');

    // For SQLite, we cannot easily modify column constraints, but the model defaults will handle new records
    console.log('✅ Window invoices not null constraints fix completed');
    
  } catch (error) {
    console.error('Error fixing window invoices not null constraints:', error);
    throw error;
  }
};