const { sequelize } = require('../config/db');

async function createSuppliersTable() {
  try {
    console.log('Creating suppliers table...');
    
    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'suppliers'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ suppliers table already exists');
      return;
    }

    // Create suppliers table
    await sequelize.query(`
      CREATE TABLE suppliers (
        supplier_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        opening_balance DECIMAL(15, 2) DEFAULT 0.00,
        current_balance DECIMAL(15, 2) DEFAULT 0.00,
        status ENUM('active', 'inactive') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
        INDEX idx_supplier_company (company_id),
        INDEX idx_supplier_name (name),
        INDEX idx_supplier_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ suppliers table created successfully');
  } catch (error) {
    console.error('Error creating suppliers table:', error.message);
    throw error;
  }
}

module.exports = createSuppliersTable;
