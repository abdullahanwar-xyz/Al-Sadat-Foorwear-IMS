const { sequelize } = require('../config/db');

async function addMissingColumnsToInvoiceItems() {
  try {
    // Check what columns currently exist
    const checkColumnQuery = `PRAGMA table_info(invoice_items);`;
    const columns = await sequelize.query(checkColumnQuery, { type: sequelize.QueryTypes.SELECT });
    
    const columnNames = columns.map(col => col.name);
    console.log('Current columns in invoice_items:', columnNames.join(', '));

    // List of columns that should be in the table
    const requiredColumns = [
      { name: 'productId', type: 'INTEGER' },
      { name: 'itemName', type: 'TEXT' },
      { name: 'type', type: 'TEXT' },
      { name: 'color', type: 'TEXT' },
      { name: 'size', type: 'REAL' },
      { name: 'totalFeet', type: 'REAL' },
      { name: 'grossValue', type: 'REAL' },
      { name: 'discount', type: 'REAL' },
      { name: 'netValue', type: 'REAL' }
    ];
    
    // Add missing columns one by one
    for (const column of requiredColumns) {
      if (!columnNames.includes(column.name)) {
        try {
          await sequelize.query(
            `ALTER TABLE invoice_items ADD COLUMN ${column.name} ${column.type};`
          );
          console.log(`Added column ${column.name} to invoice_items table`);
        } catch (err) {
          console.error(`Error adding column ${column.name}:`, err);
        }
      }
    }
    
    console.log('Migration completed for invoice_items table');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = addMissingColumnsToInvoiceItems;
