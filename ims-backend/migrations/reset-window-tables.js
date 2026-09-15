const { sequelize } = require('../config/db');
const ensureWindowTables = require('./ensure-window-tables');

async function resetWindowTables() {
  console.log('🔄 Resetting window tables for fresh migration...');
  
  try {
    // Drop all window-related tables in correct order (reverse dependency order)
    const tablesToDrop = [
      'window_invoice_items',
      'window_invoice_payments', 
      'window_invoices',
      'window_invoice_settings',
      'window_calculations',
      'window_settings'
    ];
    
    console.log('🗑️ Dropping existing window tables...');
    for (const tableName of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`✅ Dropped table: ${tableName}`);
      } catch (error) {
        console.log(`ℹ️ Table ${tableName} did not exist or could not be dropped: ${error.message}`);
      }
    }
    
    // Wait a moment for SQLite to process the drops
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔨 Creating fresh window tables...');
    // Now create all tables fresh
    await ensureWindowTables();
    
    console.log('✅ Window tables reset completed successfully!');
    
    // Verify tables were created
    const [tables] = await sequelize.query(`
      SELECT name FROM sqlite_master WHERE type='table' 
      AND name IN (
        'window_calculations', 
        'window_settings', 
        'window_invoice_settings', 
        'window_invoices', 
        'window_invoice_items', 
        'window_invoice_payments'
      )
      ORDER BY name
    `);
    
    console.log('📋 Verified fresh window tables:');
    tables.forEach(table => {
      console.log(`  ✓ ${table.name}`);
    });
    
    if (tables.length === 6) {
      console.log('🎉 All 6 window tables created successfully!');
    } else {
      console.log(`⚠️ Only ${tables.length} out of 6 tables were created`);
    }
    
  } catch (error) {
    console.error('❌ Error resetting window tables:', error);
    throw error;
  }
}

module.exports = resetWindowTables;