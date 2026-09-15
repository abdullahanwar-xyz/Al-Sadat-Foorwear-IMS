const { sequelize } = require('../config/db');

async function removeGlassHeightSutureValueMigration() {
  try {
    console.log('🔄 Removing glassHeightSutureValue column from window_settings...');
    
    // Check if the column exists
    const [results] = await sequelize.query(`PRAGMA table_info(window_settings);`);
    const existingColumns = results.map(row => row.name);
    
    console.log('Current window_settings columns:', existingColumns);
    
    if (existingColumns.includes('glassHeightSutureValue')) {
      console.log('Removing glassHeightSutureValue column...');
      
      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      // First, get all current data
      const [settingsData] = await sequelize.query(`SELECT * FROM window_settings;`);
      
      if (settingsData.length > 0) {
        console.log(`Found ${settingsData.length} settings records to preserve`);
        
        // Create a temporary table with the correct structure (without glassHeightSutureValue)
        await sequelize.query(`
          CREATE TABLE window_settings_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jTypeHeightDeduction DECIMAL(10, 2) NOT NULL DEFAULT 6.3,
            cTypeHeightDeduction DECIMAL(10, 2) NOT NULL DEFAULT 4.4,
            jType2DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 17.5,
            cType2DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 15.5,
            jType3DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 21.8,
            cType3DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 20.0,
            jType4DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 31.3,
            cType4DoorWidthDeduction DECIMAL(10, 2) NOT NULL DEFAULT 29.3,
            pushLockAddition DECIMAL(10, 2) NOT NULL DEFAULT 5.5,
            leachLockAddition DECIMAL(10, 2) NOT NULL DEFAULT 8.8,
            threeDoorPanel1Addition DECIMAL(10, 2) NOT NULL DEFAULT 7.0,
            threeDoorPanel2Addition DECIMAL(10, 2) NOT NULL DEFAULT 14.0,
            threeDoorFixedWidth DECIMAL(10, 2) NOT NULL DEFAULT 172.3,
            fourDoorFixedWidth DECIMAL(10, 2) NOT NULL DEFAULT 172.3,
            glassWidthSutureValue DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
            glassHeightDeduction DECIMAL(10, 2) NOT NULL DEFAULT 4.0,
            isActive BOOLEAN NOT NULL DEFAULT 1,
            version VARCHAR(255) NOT NULL DEFAULT '1.0',
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL
          );
        `);
        
        // Copy data from original table to temp table (excluding glassHeightSutureValue)
        for (const row of settingsData) {
          await sequelize.query(`
            INSERT INTO window_settings_temp (
              id, jTypeHeightDeduction, cTypeHeightDeduction,
              jType2DoorWidthDeduction, cType2DoorWidthDeduction,
              jType3DoorWidthDeduction, cType3DoorWidthDeduction,
              jType4DoorWidthDeduction, cType4DoorWidthDeduction,
              pushLockAddition, leachLockAddition,
              threeDoorPanel1Addition, threeDoorPanel2Addition,
              threeDoorFixedWidth, fourDoorFixedWidth,
              glassWidthSutureValue, glassHeightDeduction,
              isActive, version, createdAt, updatedAt
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            );
          `, {
            replacements: [
              row.id,
              row.jTypeHeightDeduction,
              row.cTypeHeightDeduction,
              row.jType2DoorWidthDeduction,
              row.cType2DoorWidthDeduction,
              row.jType3DoorWidthDeduction,
              row.cType3DoorWidthDeduction,
              row.jType4DoorWidthDeduction,
              row.cType4DoorWidthDeduction,
              row.pushLockAddition,
              row.leachLockAddition,
              row.threeDoorPanel1Addition,
              row.threeDoorPanel2Addition,
              row.threeDoorFixedWidth,
              row.fourDoorFixedWidth,
              row.glassWidthSutureValue || 1.0,
              row.glassHeightDeduction || 4.0,
              row.isActive,
              row.version,
              row.createdAt,
              row.updatedAt
            ]
          });
        }
        
        // Drop original table and rename temp table
        await sequelize.query(`DROP TABLE window_settings;`);
        await sequelize.query(`ALTER TABLE window_settings_temp RENAME TO window_settings;`);
        
        console.log('✅ Successfully removed glassHeightSutureValue column and preserved data');
      } else {
        console.log('No existing settings data found');
      }
    } else {
      console.log('✅ glassHeightSutureValue column does not exist, skipping removal');
    }
    
    // Ensure glassHeightDeduction is set to 4.0 for all existing records
    await sequelize.query(`
      UPDATE window_settings 
      SET glassHeightDeduction = 4.0 
      WHERE glassHeightDeduction IS NULL OR glassHeightDeduction != 4.0;
    `);
    
    console.log('✅ Updated glassHeightDeduction to 4.0 for all records');
    
    // Final verification
    const [finalResults] = await sequelize.query(`PRAGMA table_info(window_settings);`);
    const finalColumns = finalResults.map(row => row.name);
    
    console.log('Final window_settings columns:', finalColumns);
    
    if (!finalColumns.includes('glassHeightSutureValue')) {
      console.log('🎉 Migration completed successfully!');
      console.log('✅ glassHeightSutureValue column removed');
      console.log('✅ glassWidthSutureValue column preserved');
      console.log('✅ glassHeightDeduction set to 4.0');
    } else {
      throw new Error('Failed to remove glassHeightSutureValue column');
    }
    
    return {
      success: true,
      removedColumn: 'glassHeightSutureValue',
      preservedColumns: ['glassWidthSutureValue', 'glassHeightDeduction']
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  removeGlassHeightSutureValueMigration()
    .then((result) => {
      console.log('\n✅ Migration completed successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = removeGlassHeightSutureValueMigration;