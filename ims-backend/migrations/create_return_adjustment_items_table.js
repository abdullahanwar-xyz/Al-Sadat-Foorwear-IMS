const { sequelize } = require('../config/db');

async function createReturnAdjustmentItemsTable() {
  try {
    console.log('Creating return_adjustment_items table...');

    // Check if the table already exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'return_adjustment_items';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists.length > 0) {
      console.log('return_adjustment_items table already exists');
      return;
    }

    // Create the return_adjustment_items table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS return_adjustment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        returnAdjustmentId INTEGER NOT NULL,
        invoiceItemId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        color TEXT NOT NULL,
        size REAL NOT NULL,
        returnQuantity INTEGER NOT NULL,
        rate REAL NOT NULL,
        amount REAL NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (returnAdjustmentId) REFERENCES return_adjustments(id) ON DELETE CASCADE,
        FOREIGN KEY (invoiceItemId) REFERENCES invoice_items(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for better performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_return_adjustment_items_return_adjustment_id 
      ON return_adjustment_items (returnAdjustmentId);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_return_adjustment_items_invoice_item_id 
      ON return_adjustment_items (invoiceItemId);
    `);

    console.log('Successfully created return_adjustment_items table');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = createReturnAdjustmentItemsTable;
