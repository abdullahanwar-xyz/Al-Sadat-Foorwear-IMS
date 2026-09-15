const { sequelize } = require('../config/db');

async function createProductSizesTable() {
  try {
    console.log('Creating product_sizes table...');

    // Check if the table already exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_sizes';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists.length > 0) {
      console.log('product_sizes table already exists, dropping and recreating with new structure');
      await sequelize.query('DROP TABLE IF EXISTS product_sizes;');
    }

    // Create the product_sizes table with the new structure
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productColorRateId INTEGER NOT NULL,
        size REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'feet',
        UNIQUE(productColorRateId, size),
        FOREIGN KEY (productColorRateId) REFERENCES product_color_rates(id) ON DELETE CASCADE
      );
    `);

    // Create index for better performance
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS product_color_size_unique ON product_sizes (productColorRateId, size);
    `);

    console.log('Successfully created product_sizes table with new structure');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = createProductSizesTable;
