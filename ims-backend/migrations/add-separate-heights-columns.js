const { sequelize } = require('../config/db');

async function addSeparateHeightsColumns() {
  try {
    console.log('🔄 Adding separate heights columns to window_calculations table...');
    
    // Check if the columns already exist
    const [results] = await sequelize.query(`PRAGMA table_info(window_calculations);`);
    const existingColumns = results.map(row => row.name);
    
    console.log('Current columns:', existingColumns);
    
    // Add useSeparateHeights column if it doesn't exist
    if (!existingColumns.includes('useSeparateHeights')) {
      console.log('Adding useSeparateHeights column...');
      await sequelize.query(`
        ALTER TABLE window_calculations 
        ADD COLUMN useSeparateHeights BOOLEAN DEFAULT 0;
      `);
      console.log('✅ useSeparateHeights column added successfully');
    } else {
      console.log('✅ useSeparateHeights column already exists');
    }
    
    // Add leftHeight column if it doesn't exist
    if (!existingColumns.includes('leftHeight')) {
      console.log('Adding leftHeight column...');
      await sequelize.query(`
        ALTER TABLE window_calculations 
        ADD COLUMN leftHeight DECIMAL(10, 2) DEFAULT NULL;
      `);
      console.log('✅ leftHeight column added successfully');
    } else {
      console.log('✅ leftHeight column already exists');
    }
    
    // Add rightHeight column if it doesn't exist
    if (!existingColumns.includes('rightHeight')) {
      console.log('Adding rightHeight column...');
      await sequelize.query(`
        ALTER TABLE window_calculations 
        ADD COLUMN rightHeight DECIMAL(10, 2) DEFAULT NULL;
      `);
      console.log('✅ rightHeight column added successfully');
    } else {
      console.log('✅ rightHeight column already exists');
    }
    
    // Add fixedLeftHeight column if it doesn't exist
    if (!existingColumns.includes('fixedLeftHeight')) {
      console.log('Adding fixedLeftHeight column...');
      await sequelize.query(`
        ALTER TABLE window_calculations 
        ADD COLUMN fixedLeftHeight DECIMAL(10, 2) DEFAULT NULL;
      `);
      console.log('✅ fixedLeftHeight column added successfully');
    } else {
      console.log('✅ fixedLeftHeight column already exists');
    }
    
    // Add fixedRightHeight column if it doesn't exist
    if (!existingColumns.includes('fixedRightHeight')) {
      console.log('Adding fixedRightHeight column...');
      await sequelize.query(`
        ALTER TABLE window_calculations 
        ADD COLUMN fixedRightHeight DECIMAL(10, 2) DEFAULT NULL;
      `);
      console.log('✅ fixedRightHeight column added successfully');
    } else {
      console.log('✅ fixedRightHeight column already exists');
    }
    
    console.log('🎉 Separate heights columns migration completed successfully!');
    console.log('Added columns: useSeparateHeights, leftHeight, rightHeight, fixedLeftHeight, fixedRightHeight');
    
  } catch (error) {
    console.error('❌ Error adding separate heights columns:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addSeparateHeightsColumns()
    .then(() => {
      console.log('Migration completed. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addSeparateHeightsColumns;