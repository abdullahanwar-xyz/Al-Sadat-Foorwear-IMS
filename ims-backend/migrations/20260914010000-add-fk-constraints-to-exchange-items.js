// exchange_items.returnItemId and .newInvoiceItemId were plain INTEGER
// columns with no real DB foreign key (verified via information_schema:
// zero FK constraints on the table). invoiceController's force-delete path
// destroys ReturnItem rows (and later all InvoiceItem rows) without any
// code cleaning up their ExchangeItem children, so a force-deleted invoice
// with an exchange left exchange_items rows behind pointing at nothing.
//
// returnItemId gets ON DELETE CASCADE - an ExchangeItem has no meaning
// without its parent ReturnItem, so deleting the return should delete its
// exchange lines too (this is what actually closes the orphan hole).
// newInvoiceItemId gets ON DELETE SET NULL - it's already nullable and just
// points at "the real invoice item this exchange line created, if any";
// losing that invoice item shouldn't delete the exchange history record,
// same pattern as bank_account_id/created_by elsewhere in this codebase.
module.exports = {
  up: async (queryInterface) => {
    // Every current row is already orphaned (confirmed: all 8 existing rows
    // point at already-deleted return_items/invoice_items, leftover from
    // testing before this fix existed) - safe to clear before adding the
    // constraints, nothing valid to lose.
    await queryInterface.sequelize.query(`
      DELETE ei FROM exchange_items ei
      LEFT JOIN return_items ri ON ei.returnItemId = ri.id
      WHERE ri.id IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE exchange_items ei
      LEFT JOIN invoice_items ii ON ei.newInvoiceItemId = ii.id
      SET ei.newInvoiceItemId = NULL
      WHERE ei.newInvoiceItemId IS NOT NULL AND ii.id IS NULL
    `);

    await queryInterface.addConstraint('exchange_items', {
      fields: ['returnItemId'],
      type: 'foreign key',
      name: 'exchange_items_return_item_id_fkey',
      references: { table: 'return_items', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('exchange_items', {
      fields: ['newInvoiceItemId'],
      type: 'foreign key',
      name: 'exchange_items_new_invoice_item_id_fkey',
      references: { table: 'invoice_items', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('exchange_items', 'exchange_items_new_invoice_item_id_fkey');
    await queryInterface.removeConstraint('exchange_items', 'exchange_items_return_item_id_fkey');
  },
};
