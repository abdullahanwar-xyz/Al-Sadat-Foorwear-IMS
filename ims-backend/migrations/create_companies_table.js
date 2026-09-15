const { sequelize } = require('../config/db');

async function createCompaniesTable() {
  try {
    console.log('Creating companies table...');
    
    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'companies'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ companies table already exists');
      return;
    }

    // Create companies table
    await sequelize.query(`
      CREATE TABLE companies (
        company_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        contact VARCHAR(50),
        opening_balance DECIMAL(15, 2) DEFAULT 0.00,
        current_balance DECIMAL(15, 2) DEFAULT 0.00,
        status ENUM('active', 'inactive') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company_name (name),
        INDEX idx_company_city (city),
        INDEX idx_company_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ companies table created successfully');
  } catch (error) {
    console.error('Error creating companies table:', error.message);
    throw error;
  }
}

module.exports = createCompaniesTable;
