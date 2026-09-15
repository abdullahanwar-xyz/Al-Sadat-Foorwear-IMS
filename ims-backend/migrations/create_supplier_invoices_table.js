const { sequelize } = require('../config/db');

async function createSupplierInvoicesTable() {
  try {
    console.log('Creating supplier_invoices table...');
    
    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'supplier_invoices'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ supplier_invoices table already exists');
      return;
    }

    // Create supplier_invoices table
    await sequelize.query(`
      CREATE TABLE supplier_invoices (
        invoice_id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        company_id INT NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        paid_amount DECIMAL(15, 2) DEFAULT 0.00,
        pending_amount DECIMAL(15, 2) NOT NULL,
        status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
        description TEXT,
        due_date DATE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
        INDEX idx_supplier_invoice_supplier (supplier_id),
        INDEX idx_supplier_invoice_company (company_id),
        INDEX idx_supplier_invoice_number (invoice_number),
        INDEX idx_supplier_invoice_date (invoice_date),
        INDEX idx_supplier_invoice_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ supplier_invoices table created successfully');
  } catch (error) {
    console.error('Error creating supplier_invoices table:', error.message);
    throw error;
  }
}

module.exports = createSupplierInvoicesTable;
