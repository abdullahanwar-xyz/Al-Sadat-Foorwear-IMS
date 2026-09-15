const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const sourceDbPath = path.join(__dirname, '..', 'ims.sqlite');
  const targetDbPath = process.env.DB_PATH;
  
  console.log('🔧 Initializing database...');
  console.log('📂 Source DB:', sourceDbPath);
  console.log('📁 Target DB:', targetDbPath);
  
  if (!targetDbPath) {
    throw new Error('❌ DB_PATH environment variable not set');
  }
  
  // Create the directory if it doesn't exist
  const targetDir = path.dirname(targetDbPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('📁 Created directory:', targetDir);
  }
  
  const targetExists = fs.existsSync(targetDbPath);
  const sourceExists = fs.existsSync(sourceDbPath);
  
  if (targetExists) {
    console.log('✅ Database already exists at:', targetDbPath);
    // Even if database exists, we need to ensure window tables are created
    await ensureProductionTables();
    return;
  }
  
  if (sourceExists) {
    try {
      // Copy the database file
      fs.copyFileSync(sourceDbPath, targetDbPath);
      console.log('✅ Database copied successfully to:', targetDbPath);
    } catch (error) {
      console.error('❌ Error copying database:', error);
      throw error;
    }
  } else {
    console.log('⚠️ Source database not found, will create new database');
  }
  
  // Ensure production tables after database is set up
  await ensureProductionTables();
}

async function ensureProductionTables() {
  console.log('🔧 Ensuring production database has all required tables...');
  
  try {
    // Import database connection and ensure window tables
    const { sequelize } = require('../config/db');
    const ensureWindowTables = require('../migrations/ensure-window-tables');
    
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection verified');
    
    // Ensure all window tables exist
    await ensureWindowTables();
    
    console.log('✅ Production database tables verified');
  } catch (error) {
    console.error('❌ Error ensuring production tables:', error);
    // Don't throw - let the app continue even if this fails
    console.log('⚠️ Will attempt to create tables during server startup...');
  }
}

module.exports = { initializeDatabase };
