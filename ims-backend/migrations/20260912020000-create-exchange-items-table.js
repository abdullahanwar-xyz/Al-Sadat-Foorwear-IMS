const { DataTypes } = require('sequelize');

// Multi-item exchange support: one returned item can now be swapped for
// several different new items, not just one. The new items move from
// singular columns on return_items into their own child table, one row per
// new item, linked back via returnItemId.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exchange_items', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      returnItemId: { type: DataTypes.INTEGER, allowNull: false },
      productColorRateId: { type: DataTypes.INTEGER, allowNull: false },
      size: { type: DataTypes.FLOAT, allowNull: false },
      quantity: { type: DataTypes.FLOAT, allowNull: false },
      rate: { type: DataTypes.FLOAT, allowNull: false },
      newInvoiceItemId: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // Carry forward every existing exchange's single new item into the new
    // table before the old columns disappear.
    const [existingExchanges] = await queryInterface.sequelize.query(
      `SELECT id, newProductColorRateId, newSize, newQuantity, newRate, newInvoiceItemId
       FROM return_items WHERE isExchange = true`
    );
    const now = new Date();
    for (const row of existingExchanges) {
      await queryInterface.bulkInsert('exchange_items', [{
        returnItemId: row.id,
        productColorRateId: row.newProductColorRateId,
        size: row.newSize,
        quantity: row.newQuantity,
        rate: row.newRate,
        newInvoiceItemId: row.newInvoiceItemId,
        createdAt: now,
        updatedAt: now,
      }]);
    }

    await queryInterface.removeColumn('return_items', 'newProductColorRateId');
    await queryInterface.removeColumn('return_items', 'newSize');
    await queryInterface.removeColumn('return_items', 'newQuantity');
    await queryInterface.removeColumn('return_items', 'newRate');
    await queryInterface.removeColumn('return_items', 'newItemName');
    await queryInterface.removeColumn('return_items', 'newInvoiceItemId');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('return_items', 'newProductColorRateId', { type: DataTypes.INTEGER, allowNull: true });
    await queryInterface.addColumn('return_items', 'newSize', { type: DataTypes.FLOAT, allowNull: true });
    await queryInterface.addColumn('return_items', 'newQuantity', { type: DataTypes.FLOAT, allowNull: true });
    await queryInterface.addColumn('return_items', 'newRate', { type: DataTypes.FLOAT, allowNull: true });
    await queryInterface.addColumn('return_items', 'newItemName', { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn('return_items', 'newInvoiceItemId', { type: DataTypes.INTEGER, allowNull: true });

    const [rows] = await queryInterface.sequelize.query('SELECT * FROM exchange_items');
    for (const row of rows) {
      await queryInterface.sequelize.query(
        `UPDATE return_items SET newProductColorRateId = ?, newSize = ?, newQuantity = ?, newRate = ?, newInvoiceItemId = ?
         WHERE id = ?`,
        { replacements: [row.productColorRateId, row.size, row.quantity, row.rate, row.newInvoiceItemId, row.returnItemId] }
      );
    }

    await queryInterface.dropTable('exchange_items');
  },
};
