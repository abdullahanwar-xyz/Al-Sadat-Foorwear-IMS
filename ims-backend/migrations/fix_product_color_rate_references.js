const { sequelize } = require('../config/db');

async function fixProductColorRateReferences() {
  try {
    console.log('Fixing product color rate references in invoice items...');

    // First, let's check the current state
    const invalidItems = await sequelize.query(`
      SELECT ii.id, ii.productId, ii.color, ii.productColorRateId
      FROM invoice_items ii
      LEFT JOIN product_color_rates pcr ON ii.productColorRateId = pcr.id
      WHERE pcr.id IS NULL OR pcr.productId != ii.productId OR pcr.color != ii.color;
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`Found ${invalidItems.length} invoice items with invalid product color rate references`);

    if (invalidItems.length > 0) {
      // Fix each invalid item
      for (const item of invalidItems) {
        console.log(`Fixing invoice item ${item.id} (productId: ${item.productId}, color: ${item.color})`);
        
        // Try to find the correct productColorRateId
        const correctRate = await sequelize.query(`
          SELECT id FROM product_color_rates 
          WHERE productId = ? AND color = ?
          LIMIT 1;
        `, {
          replacements: [item.productId, item.color],
          type: sequelize.QueryTypes.SELECT
        });

        if (correctRate.length > 0) {
          // Update with correct productColorRateId
          await sequelize.query(`
            UPDATE invoice_items 
            SET productColorRateId = ? 
            WHERE id = ?;
          `, {
            replacements: [correctRate[0].id, item.id]
          });
          console.log(`  - Updated to use productColorRateId: ${correctRate[0].id}`);
        } else {
          // Create a new product color rate entry
          console.log(`  - No matching color rate found, creating new one`);
          
          // Get the rate from the invoice item
          const itemData = await sequelize.query(`
            SELECT rate FROM invoice_items WHERE id = ?;
          `, {
            replacements: [item.id],
            type: sequelize.QueryTypes.SELECT
          });

          if (itemData.length > 0) {
            const rate = itemData[0].rate;
            
            // Create new product color rate
            const [newRate] = await sequelize.query(`
              INSERT INTO product_color_rates (productId, color, rate)
              VALUES (?, ?, ?)
              RETURNING id;
            `, {
              replacements: [item.productId, item.color, rate],
              type: sequelize.QueryTypes.INSERT
            });

            // Update invoice item with new productColorRateId
            await sequelize.query(`
              UPDATE invoice_items 
              SET productColorRateId = ? 
              WHERE id = ?;
            `, {
              replacements: [newRate, item.id]
            });
            console.log(`  - Created new productColorRate with id: ${newRate}`);
          }
        }
      }
    }

    // Verify the fix
    const remainingInvalidItems = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM invoice_items ii
      LEFT JOIN product_color_rates pcr ON ii.productColorRateId = pcr.id
      WHERE pcr.id IS NULL OR pcr.productId != ii.productId OR pcr.color != ii.color;
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`Remaining invalid items: ${remainingInvalidItems[0].count}`);
    console.log('Product color rate references fix completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = fixProductColorRateReferences;
