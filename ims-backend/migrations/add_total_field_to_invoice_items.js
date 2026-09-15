const { sequelize } = require('../config/db');

async function addTotalFieldToInvoiceItems() {
  try {
    // Check if the column already exists
    const columns = await sequelize.query(
      `PRAGMA table_info(invoice_items);`, 
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const totalFieldExists = columns.some(column => column.name === 'total');
    
    if (!totalFieldExists) {
      console.log('Adding total field to invoice_items table');
      
      // In SQLite, we can't add a NOT NULL constraint directly,
      // so we need to create a new table with the desired schema
      await sequelize.transaction(async (t) => {
        // 1. Create a new table with all columns including the total field
        await sequelize.query(`
          CREATE TABLE invoice_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoiceId INTEGER NOT NULL,
            productId INTEGER NOT NULL,
            productColorRateId INTEGER NOT NULL DEFAULT 1,
            itemName TEXT,
            type TEXT,
            color TEXT,
            size REAL,
            quantity REAL NOT NULL,
            rate REAL NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            totalFeet REAL,
            grossValue REAL,
            discount REAL DEFAULT 0,
            netValue REAL
          );
        `, { transaction: t });
        
        // 2. Copy data from the old table to the new table, calculating total where missing
        await sequelize.query(`
          INSERT INTO invoice_items_new (
            id, invoiceId, productId, productColorRateId, itemName, type, color, size, 
            quantity, rate, total, totalFeet, grossValue, discount, netValue
          )
          SELECT 
            id, invoiceId, productId, productColorRateId, itemName, type, color, size, 
            quantity, rate, (quantity * rate), totalFeet, grossValue, discount, netValue
          FROM invoice_items;
        `, { transaction: t });
        
        // 3. Drop old table
        await sequelize.query(`DROP TABLE invoice_items;`, { transaction: t });
        
        // 4. Rename new table to original name
        await sequelize.query(`ALTER TABLE invoice_items_new RENAME TO invoice_items;`, { transaction: t });
      });
      
      console.log('Total field added successfully to invoice_items table');
    } else {
      console.log('Total field already exists in invoice_items table');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = addTotalFieldToInvoiceItems;
