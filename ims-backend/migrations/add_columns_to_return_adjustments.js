const { sequelize } = require('../config/db');

async function addColumnsToReturnAdjustments() {
  try {
    console.log('Adding totalAmount and remarks columns to return_adjustments table...');

    // First check if the table exists
    const tableExists = await sequelize.query(
      "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'return_adjustments';",
      { type: sequelize.QueryTypes.SELECT }
    );

    if (tableExists.length === 0) {
      console.log('return_adjustments table does not exist yet, will be created by Sequelize sync');
      return;
    }

    // Check if totalAmount column exists
    const columns = await sequelize.query(
      "SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'return_adjustments';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const hasTotalAmount = columns.some(col => col.name === 'totalAmount');
    const hasRemarks = columns.some(col => col.name === 'remarks');
    
    if (!hasTotalAmount) {
      await sequelize.query(`
        ALTER TABLE return_adjustments 
        ADD COLUMN totalAmount DECIMAL(10,2) DEFAULT 0;
      `);
      console.log('Added totalAmount column');
    } else {
      console.log('totalAmount column already exists');
    }
    
    if (!hasRemarks) {
      await sequelize.query(`
        ALTER TABLE return_adjustments 
        ADD COLUMN remarks TEXT;
      `);
      console.log('Added remarks column');
    } else {
      console.log('remarks column already exists');
    }

    console.log('Successfully updated return_adjustments table');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = addColumnsToReturnAdjustments;
