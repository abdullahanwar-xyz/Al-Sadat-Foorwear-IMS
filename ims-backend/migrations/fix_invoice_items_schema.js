const { sequelize } = require('../config/db');

async function fixInvoiceItemsSchema() {
  try {
    // First check if the product_color_rates table exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_color_rates';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    // If not, create it
    if (tableExists.length === 0) {
      console.log('Creating product_color_rates table');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS product_color_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          color TEXT NOT NULL,
          rate REAL NOT NULL,
          UNIQUE(productId, color)
        );
      `);
    }
    
    // Check if the productColorRateId column exists in invoice_items
    const columns = await sequelize.query(
      `PRAGMA table_info(invoice_items);`, 
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const columnExists = columns.some(column => column.name === 'productColorRateId');
    
    // Add the column if it doesn't exist
    if (!columnExists) {
      console.log('Adding productColorRateId column to invoice_items');
      
      // In SQLite we can't add a NOT NULL column without a default value
      await sequelize.query(`ALTER TABLE invoice_items ADD COLUMN productColorRateId INTEGER DEFAULT 1;`);
      
      // Populate with data if possible (based on productId and color)
      await sequelize.query(`
        UPDATE invoice_items SET productColorRateId = (
          SELECT pcr.id FROM product_color_rates pcr 
          WHERE pcr.productId = invoice_items.productId 
          AND pcr.color = invoice_items.color
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1 FROM product_color_rates pcr 
          WHERE pcr.productId = invoice_items.productId 
          AND pcr.color = invoice_items.color
        );
      `);
    }
    
    console.log('Invoice items schema update complete');
  } catch (error) {
    console.error('Error fixing invoice items schema:', error);
    throw error;
  }
}

module.exports = fixInvoiceItemsSchema;
