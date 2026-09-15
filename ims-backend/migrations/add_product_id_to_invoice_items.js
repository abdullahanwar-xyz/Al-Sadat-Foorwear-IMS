const { sequelize } = require('../config/db');

async function addProductIdToInvoiceItems() {
  try {
    // Check if the column already exists
    const checkColumnQuery = `PRAGMA table_info(invoice_items);`;
    const columns = await sequelize.query(checkColumnQuery, { type: sequelize.QueryTypes.SELECT });
    
    const productIdExists = columns.some(column => column.name === 'productId');
    
    if (!productIdExists) {
      // Add productId column
      await sequelize.query(`ALTER TABLE invoice_items ADD COLUMN productId INTEGER;`);
      console.log('productId column added successfully to invoice_items table');
    } else {
      console.log('productId column already exists in invoice_items table');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = addProductIdToInvoiceItems;
