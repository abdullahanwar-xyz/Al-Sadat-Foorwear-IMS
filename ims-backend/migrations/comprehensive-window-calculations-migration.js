const { sequelize } = require('../config/db');

async function comprehensiveWindowCalculationsMigration() {
  try {
    console.log('🔄 Running comprehensive window calculations migration...');
    
    // Check window_calculations table schema
    const [results] = await sequelize.query(`PRAGMA table_info(window_calculations);`);
    const existingColumns = results.map(row => row.name);
    
    console.log('Current window_calculations columns:', existingColumns);
    
    // Check window_settings table schema
    const [settingsResults] = await sequelize.query(`PRAGMA table_info(window_settings);`);
    const existingSettingsColumns = settingsResults.map(row => row.name);
    
    console.log('Current window_settings columns:', existingSettingsColumns);
    
    // Define all expected columns with their schema
    const expectedColumns = [
      {
        name: 'sessionId',
        definition: 'TEXT DEFAULT NULL',
        description: 'Session ID for grouping windows'
      },
      {
        name: 'windowsData',
        definition: 'TEXT DEFAULT NULL',
        description: 'JSON data for all windows in the session'
      },
      {
        name: 'totalWindows',
        definition: 'INTEGER DEFAULT 0',
        description: 'Total number of windows in the session'
      },
      {
        name: 'calculationResults',
        definition: 'TEXT DEFAULT NULL',
        description: 'JSON data for calculation results'
      },
      {
        name: 'productType',
        definition: 'TEXT DEFAULT "Window"',
        description: 'Product type (Window or Ventilator)'
      },
      {
        name: 'fixedAreaHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Fixed area height for calculations'
      },
      {
        name: 'windowNumber',
        definition: 'TEXT DEFAULT NULL',
        description: 'Window identification number'
      },
      {
        name: 'window_number',
        definition: 'TEXT DEFAULT NULL',
        description: 'Alternative window number field (snake_case)'
      },
      {
        name: 'glassType',
        definition: 'TEXT DEFAULT NULL',
        description: 'Glass type (S, F, P)'
      },
      {
        name: 'glass_type',
        definition: 'TEXT DEFAULT NULL',
        description: 'Alternative glass type field (snake_case)'
      },
      {
        name: 'session_id',
        definition: 'TEXT DEFAULT NULL',
        description: 'Alternative session ID field (snake_case)'
      },
      {
        name: 'useSeparateHeights',
        definition: 'BOOLEAN DEFAULT 0',
        description: 'Whether to use separate left/right heights'
      },
      {
        name: 'leftHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Left side height'
      },
      {
        name: 'rightHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Right side height'
      },
      {
        name: 'fixedLeftHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Fixed left height after door deduction'
      },
      {
        name: 'fixedRightHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Fixed right height after door deduction'
      },
      {
        name: 'usableHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Usable height for calculations'
      },
      {
        name: 'baseWidths',
        definition: 'TEXT DEFAULT "[]"',
        description: 'Base widths as JSON array'
      },
      {
        name: 'hasVentilator',
        definition: 'BOOLEAN DEFAULT 0',
        description: 'Whether the window has a ventilator'
      },
      {
        name: 'glassWidth',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Calculated glass width'
      },
      {
        name: 'glassHeight',
        definition: 'DECIMAL(10, 2) DEFAULT NULL',
        description: 'Calculated glass height'
      }
    ];
    
    // Define expected window_settings columns
    const expectedSettingsColumns = [
      {
        name: 'glassWidthSutureValue',
        definition: 'DECIMAL(10, 2) DEFAULT 1.0',
        description: 'Glass width suture value for calculations'
      },
      {
        name: 'glassHeightDeduction',
        definition: 'DECIMAL(10, 2) DEFAULT 4.0',
        description: 'Glass height deduction for calculations'
      }
    ];
    
    let addedColumns = [];
    let addedSettingsColumns = [];
    
    // Add missing columns to window_calculations
    for (const column of expectedColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding missing column: ${column.name} (${column.description})`);
        
        try {
          await sequelize.query(`
            ALTER TABLE window_calculations 
            ADD COLUMN ${column.name} ${column.definition};
          `);
          addedColumns.push(column.name);
          console.log(`✅ Added column: ${column.name}`);
        } catch (error) {
          console.error(`❌ Failed to add column ${column.name}:`, error.message);
          // Continue with other columns even if one fails
        }
      } else {
        console.log(`✅ Column ${column.name} already exists`);
      }
    }
    
    // Add missing columns to window_settings
    for (const column of expectedSettingsColumns) {
      if (!existingSettingsColumns.includes(column.name)) {
        console.log(`Adding missing settings column: ${column.name} (${column.description})`);
        
        try {
          await sequelize.query(`
            ALTER TABLE window_settings 
            ADD COLUMN ${column.name} ${column.definition};
          `);
          addedSettingsColumns.push(column.name);
          console.log(`✅ Added settings column: ${column.name}`);
        } catch (error) {
          console.error(`❌ Failed to add settings column ${column.name}:`, error.message);
          // Continue with other columns even if one fails
        }
      } else {
        console.log(`✅ Settings column ${column.name} already exists`);
      }
    }
    
    // Update legacy records with proper defaults
    console.log('\n🔄 Updating legacy records with proper defaults...');
    
    // Fix NULL sessionIds
    const nullSessionCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM window_calculations 
      WHERE sessionId IS NULL OR sessionId = '';
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (nullSessionCount[0].count > 0) {
      await sequelize.query(`
        UPDATE window_calculations 
        SET sessionId = 'legacy-' || id || '-' || strftime('%Y%m%d%H%M%S', 'now') 
        WHERE sessionId IS NULL OR sessionId = '';
      `);
      console.log(`✅ Fixed ${nullSessionCount[0].count} NULL sessionId records`);
    }
    
    // Fix NULL totalWindows
    await sequelize.query(`
      UPDATE window_calculations 
      SET totalWindows = 1 
      WHERE totalWindows IS NULL OR totalWindows = 0;
    `);
    console.log('✅ Fixed NULL totalWindows records');
    
    // Fix NULL productType
    await sequelize.query(`
      UPDATE window_calculations 
      SET productType = 'Window' 
      WHERE productType IS NULL OR productType = '';
    `);
    console.log('✅ Fixed NULL productType records');
    
    // Fix NULL windowsData by creating from legacy fields
    const nullWindowsDataCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM window_calculations 
      WHERE windowsData IS NULL OR windowsData = '';
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (nullWindowsDataCount[0].count > 0) {
      const legacyRecords = await sequelize.query(`
        SELECT id, inputHeight, inputWidth, productType, doorCount, aluminiumType, 
               lockType, notes, windowNumber, glassType, useSeparateHeights, 
               leftHeight, rightHeight
        FROM window_calculations 
        WHERE windowsData IS NULL OR windowsData = '';
      `, { type: sequelize.QueryTypes.SELECT });
      
      for (const record of legacyRecords) {
        const windowData = [{
          inputHeight: record.inputHeight || 0,
          inputWidth: record.inputWidth || 0,
          productType: record.productType || 'Window',
          doorCount: record.doorCount || 2,
          aluminiumType: record.aluminiumType || 'J',
          lockType: record.lockType || 'Push',
          doorHeight: null,
          notes: record.notes,
          windowNumber: record.windowNumber || `Window-${record.id}`,
          glassType: record.glassType || 'S',
          useSeparateHeights: record.useSeparateHeights || false,
          leftHeight: record.leftHeight,
          rightHeight: record.rightHeight
        }];
        
        await sequelize.query(`
          UPDATE window_calculations 
          SET windowsData = ?
          WHERE id = ?;
        `, {
          replacements: [JSON.stringify(windowData), record.id]
        });
      }
      console.log(`✅ Fixed ${nullWindowsDataCount[0].count} NULL windowsData records`);
    }
    
    // Fix NULL calculationResults
    const nullCalcResultsCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM window_calculations 
      WHERE calculationResults IS NULL OR calculationResults = '';
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (nullCalcResultsCount[0].count > 0) {
      const recordsToFix = await sequelize.query(`
        SELECT id, inputHeight, inputWidth, productType, doorCount, aluminiumType, 
               lockType, finalHeight, usableHeight, finalWidths, baseWidths,
               heightDeduction, widthDeduction, lockAddition, notes, windowNumber, 
               glassType, fixedAreaHeight, useSeparateHeights, leftHeight, rightHeight,
               fixedLeftHeight, fixedRightHeight, glassWidth, glassHeight
        FROM window_calculations 
        WHERE calculationResults IS NULL OR calculationResults = '';
      `, { type: sequelize.QueryTypes.SELECT });
      
      for (const record of recordsToFix) {
        const calculationResult = [{
          windowNumber: record.windowNumber || `Window-${record.id}`,
          glassType: record.glassType || 'S',
          input: {
            height: record.inputHeight || 0,
            width: record.inputWidth || 0,
            productType: record.productType || 'Window',
            doorCount: record.doorCount || 2,
            aluminiumType: record.aluminiumType || 'J',
            lockType: record.lockType || 'Push',
            doorHeight: null,
            fixedAreaHeight: record.fixedAreaHeight,
            useSeparateHeights: record.useSeparateHeights || false,
            leftHeight: record.leftHeight,
            rightHeight: record.rightHeight,
            fixedLeftHeight: record.fixedLeftHeight,
            fixedRightHeight: record.fixedRightHeight
          },
          result: {
            finalHeight: record.finalHeight || 0,
            usableHeight: record.usableHeight || 0,
            finalWidths: record.finalWidths ? JSON.parse(record.finalWidths) : [],
            baseWidths: record.baseWidths ? JSON.parse(record.baseWidths) : [],
            heightDeduction: record.heightDeduction || 0,
            widthDeduction: record.widthDeduction || 0,
            lockAddition: record.lockAddition || 0,
            glassWidth: record.glassWidth || 0,
            glassHeight: record.glassHeight || 0
          },
          notes: record.notes
        }];
        
        await sequelize.query(`
          UPDATE window_calculations 
          SET calculationResults = ?
          WHERE id = ?;
        `, {
          replacements: [JSON.stringify(calculationResult), record.id]
        });
      }
      console.log(`✅ Fixed ${nullCalcResultsCount[0].count} NULL calculationResults records`);
    }
    
    // Final verification
    console.log('\n📊 Final verification...');
    const finalCheck = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sessionId IS NULL OR sessionId = '' THEN 1 ELSE 0 END) as nullSessionId,
        SUM(CASE WHEN windowsData IS NULL OR windowsData = '' THEN 1 ELSE 0 END) as nullWindowsData,
        SUM(CASE WHEN totalWindows IS NULL OR totalWindows = 0 THEN 1 ELSE 0 END) as nullTotalWindows,
        SUM(CASE WHEN calculationResults IS NULL OR calculationResults = '' THEN 1 ELSE 0 END) as nullCalculationResults
      FROM window_calculations;
    `, { type: sequelize.QueryTypes.SELECT });
    
    const check = finalCheck[0];
    console.log(`Total records: ${check.total}`);
    console.log(`NULL sessionId: ${check.nullSessionId}`);
    console.log(`NULL windowsData: ${check.nullWindowsData}`);
    console.log(`NULL totalWindows: ${check.nullTotalWindows}`);
    console.log(`NULL calculationResults: ${check.nullCalculationResults}`);
    
    console.log(`\n🎉 Comprehensive migration completed successfully!`);
    console.log(`Added window_calculations columns: ${addedColumns.length > 0 ? addedColumns.join(', ') : 'None (all columns already existed)'}`);
    console.log(`Added window_settings columns: ${addedSettingsColumns.length > 0 ? addedSettingsColumns.join(', ') : 'None (all columns already existed)'}`);
    
    return {
      success: true,
      addedColumns,
      addedSettingsColumns,
      totalRecords: check.total,
      nullFields: {
        sessionId: check.nullSessionId,
        windowsData: check.nullWindowsData,
        totalWindows: check.nullTotalWindows,
        calculationResults: check.nullCalculationResults
      }
    };
    
  } catch (error) {
    console.error('❌ Comprehensive migration failed:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  comprehensiveWindowCalculationsMigration()
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

module.exports = comprehensiveWindowCalculationsMigration;