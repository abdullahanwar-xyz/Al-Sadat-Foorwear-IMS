const { sequelize } = require('../config/db');

module.exports = async function updateWindowInvoicesForMultiWindow() {
  try {
    console.log('Updating window_invoices table for multi-window support...');

    // Get existing columns
    const [results] = await sequelize.query(`PRAGMA table_info(window_invoices)`);
    const existingColumns = results.map(col => col.name);
    console.log('Existing columns in window_invoices:', existingColumns);

    // Add new columns if they don't exist
    const columnsToAdd = [
      { name: 'subtotalAmount', definition: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'discountPercentage', definition: 'DECIMAL(5,2) DEFAULT 0' },
      { name: 'discountAmount', definition: 'DECIMAL(10,2) DEFAULT 0' }
    ];

    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding ${column.name} column...`);
        await sequelize.query(`ALTER TABLE window_invoices ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`✅ Added ${column.name} column`);
      } else {
        console.log(`${column.name} column already exists`);
      }
    }

    // Remove old single-window columns if they exist
    const columnsToRemove = ['width', 'height', 'quantity', 'thickness', 'type', 'totalFeed', 'finalFeed', 'feedRate'];
    
    // SQLite doesn't support DROP COLUMN directly, so we'll recreate the table if needed
    const hasOldColumns = columnsToRemove.some(col => existingColumns.includes(col));
    
    if (hasOldColumns) {
      console.log('Found old single-window columns, recreating table...');
      
      // Create new table structure
      await sequelize.query(`
        CREATE TABLE window_invoices_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customerId INTEGER NOT NULL,
          invoiceNumber VARCHAR(255) NOT NULL UNIQUE,
          date DATE NOT NULL,
          subtotalAmount DECIMAL(10,2) DEFAULT 0,
          discountPercentage DECIMAL(5,2) DEFAULT 0,
          discountAmount DECIMAL(10,2) DEFAULT 0,
          totalAmount DECIMAL(10,2) NOT NULL,
          paidAmount DECIMAL(10,2) DEFAULT 0,
          remainingAmount DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'pending',
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customerId) REFERENCES customers(id)
        )
      `);

      // Copy data from old table (excluding old columns)
      await sequelize.query(`
        INSERT INTO window_invoices_new 
        (id, customerId, invoiceNumber, date, subtotalAmount, discountPercentage, discountAmount, totalAmount, paidAmount, remainingAmount, status, notes, createdAt, updatedAt)
        SELECT 
          id, 
          customerId, 
          invoiceNumber, 
          date,
          COALESCE(subtotalAmount, totalAmount) as subtotalAmount,
          COALESCE(discountPercentage, 0) as discountPercentage,
          COALESCE(discountAmount, 0) as discountAmount,
          totalAmount, 
          paidAmount, 
          remainingAmount, 
          status, 
          notes, 
          createdAt, 
          updatedAt
        FROM window_invoices
      `);

      // Drop old table and rename new one
      await sequelize.query('DROP TABLE window_invoices');
      await sequelize.query('ALTER TABLE window_invoices_new RENAME TO window_invoices');

      console.log('✅ Recreated window_invoices table with new schema');
    }

    console.log('Window invoices table update completed successfully');
  } catch (error) {
    console.error('Error updating window_invoices table:', error);
    throw error;
  }
};