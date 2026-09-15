const { sequelize } = require('../config/db');

async function createCompanyTransactionsTable() {
  try {
    console.log('Creating company_transactions table...');
    
    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'company_transactions'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ company_transactions table already exists');
      return;
    }

    // Create company_transactions table
    await sequelize.query(`
      CREATE TABLE company_transactions (
        trans_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        supplier_id INT,
        type ENUM('credit', 'debit') NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        transaction_date DATE NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
        INDEX idx_transaction_company (company_id),
        INDEX idx_transaction_supplier (supplier_id),
        INDEX idx_transaction_type (type),
        INDEX idx_transaction_date (transaction_date),
        INDEX idx_transaction_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ company_transactions table created successfully');
  } catch (error) {
    console.error('Error creating company_transactions table:', error.message);
    throw error;
  }
}

module.exports = createCompanyTransactionsTable;
