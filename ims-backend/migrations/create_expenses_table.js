const { sequelize } = require('../config/db');

async function createExpensesTable() {
  try {
    console.log('Creating expenses table...');
    
    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'expenses'
    `);
    
    if (results[0].count > 0) {
      console.log('✓ expenses table already exists');
      return;
    }

    // Create expenses table
    await sequelize.query(`
      CREATE TABLE expenses (
        expense_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        expense_date DATE NOT NULL,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE SET NULL,
        INDEX idx_expense_company (company_id),
        INDEX idx_expense_category (category),
        INDEX idx_expense_date (expense_date),
        INDEX idx_expense_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ expenses table created successfully');
  } catch (error) {
    console.error('Error creating expenses table:', error.message);
    throw error;
  }
}

module.exports = createExpensesTable;
