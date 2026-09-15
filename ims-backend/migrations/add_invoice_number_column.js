const { sequelize } = require('../config/db');

async function addInvoiceNumberColumn() {
  try {
    // First check if the table exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists.length === 0) {
      console.log('Invoices table does not exist yet, will be created by Sequelize sync');
      return;
    }
    
    // Check if the invoiceNumber column already exists
    const checkColumnQuery = `SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices';`;
    const columns = await sequelize.query(checkColumnQuery, { type: sequelize.QueryTypes.SELECT });
    
    const columnNames = columns.map(col => col.name);
    const invoiceNumberExists = columnNames.includes('invoiceNumber');
    
    if (invoiceNumberExists) {
      console.log('Invoice number column already exists');
      return;
    }
    
    console.log('Existing columns in invoices table:', columnNames.join(', '));

    // For MySQL, we can simply add the column directly
    await sequelize.transaction(async (t) => {
      // Add the invoiceNumber column to the existing table
      await sequelize.query(`
        ALTER TABLE invoices ADD COLUMN invoiceNumber VARCHAR(255) NULL;
      `, { transaction: t });
      
      // Generate invoice numbers for existing records
      const invoices = await sequelize.query(`SELECT id FROM invoices;`, 
        { type: sequelize.QueryTypes.SELECT, transaction: t });
      
      for (const invoice of invoices) {
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoice.id).padStart(6, '0')}`;
        await sequelize.query(`UPDATE invoices SET invoiceNumber = ? WHERE id = ?;`, 
          { replacements: [invoiceNumber, invoice.id], transaction: t });
      }
      
      // Create a unique index on invoiceNumber
      await sequelize.query(`CREATE UNIQUE INDEX idx_invoice_number ON invoices (invoiceNumber);`, 
        { transaction: t });
    });
    
    console.log('Invoice number column added successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = addInvoiceNumberColumn;
