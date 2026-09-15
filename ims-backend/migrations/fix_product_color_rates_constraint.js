const { sequelize } = require('../config/db');

async function fixProductColorRatesConstraint() {
  try {
    console.log('Fixing constraints on product_color_rates table...');

    // Check if the table exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_color_rates';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists.length === 0) {
      console.log('product_color_rates table does not exist yet, will be created by Sequelize sync');
      return;
    }

    // Check existing indices
    const indices = await sequelize.query(
      "SELECT INDEX_NAME as name FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_color_rates';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log('Existing indices:', indices);

    // Check if we already have the correct unique constraint
    const hasUniqueConstraint = indices.some(index => 
      index.name === 'product_color_unique' || 
      (index.sql && index.sql.includes('productId') && index.sql.includes('color'))
    );

    if (hasUniqueConstraint) {
      console.log('Unique constraint already exists, skipping migration');
      return;
    }

    // For SQLite, we need to recreate the table to modify constraints
    await sequelize.transaction(async (t) => {
      // Temporarily disable foreign key constraints
      await sequelize.query('PRAGMA foreign_keys = OFF;', { transaction: t });
      
      // 1. Create a new table with the correct constraints
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS product_color_rates_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          color TEXT NOT NULL,
          rate REAL NOT NULL,
          UNIQUE(productId, color),
          FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
        );
      `, { transaction: t });
      
      // 2. Copy data from old table
      await sequelize.query(`
        INSERT INTO product_color_rates_new (id, productId, color, rate)
        SELECT id, productId, color, rate
        FROM product_color_rates
        GROUP BY productId, color;
      `, { transaction: t });
      
      // 3. Drop old table
      await sequelize.query(`DROP TABLE IF EXISTS product_color_rates;`, { transaction: t });
      
      // 4. Rename new table to original name
      await sequelize.query(`ALTER TABLE product_color_rates_new RENAME TO product_color_rates;`, { transaction: t });
      
      // 5. Create index on the new table
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS product_color_unique ON product_color_rates (productId, color);
      `, { transaction: t });

      // Re-enable foreign key constraints
      await sequelize.query('PRAGMA foreign_keys = ON;', { transaction: t });
    });
    
    console.log('Successfully fixed constraints on product_color_rates table');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = fixProductColorRatesConstraint;
