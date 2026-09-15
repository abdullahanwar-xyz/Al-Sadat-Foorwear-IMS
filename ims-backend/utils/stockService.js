const ProductSize = require('../models/ProductSize');

class InsufficientStockError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'InsufficientStockError';
    this.details = details;
  }
}

// Deduct stock for an exact productColorRateId + size match only. No fallback to other sizes.
//
// lock: transaction.LOCK.UPDATE takes a row lock (SELECT ... FOR UPDATE) on
// this ProductSize row for the lifetime of the caller's transaction. Without
// it, two concurrent sales for the last unit could both read quantity: 1,
// both pass the availability check below, and both decrement - overselling
// stock that doesn't exist. With the lock, the second transaction blocks
// until the first commits/rolls back, then re-reads the now-updated
// quantity and correctly fails with InsufficientStockError if it's gone.
// Every caller already passes a real transaction, so this is a drop-in
// change with no call-site updates needed.
async function deductExactStock(productColorRateId, size, quantity, transaction) {
  const productSize = await ProductSize.findOne({
    where: { productColorRateId, size },
    lock: transaction.LOCK.UPDATE,
    transaction
  });

  if (!productSize) {
    throw new InsufficientStockError(
      `No stock record found for size ${size} (productColorRateId ${productColorRateId})`,
      { productColorRateId, size, requestedQuantity: quantity, availableQuantity: 0 }
    );
  }

  if (productSize.quantity < quantity) {
    throw new InsufficientStockError(
      `Insufficient stock for size ${size} (productColorRateId ${productColorRateId}): requested ${quantity}, available ${productSize.quantity}`,
      { productColorRateId, size, requestedQuantity: quantity, availableQuantity: productSize.quantity }
    );
  }

  productSize.quantity -= quantity;
  await productSize.save({ transaction });
  return productSize;
}

// Restore stock for an exact productColorRateId + size match only. No fallback to other sizes.
async function restoreExactStock(productColorRateId, size, quantity, transaction) {
  const productSize = await ProductSize.findOne({
    where: { productColorRateId, size },
    transaction
  });

  if (!productSize) {
    throw new InsufficientStockError(
      `No stock record found for size ${size} (productColorRateId ${productColorRateId}) to restore stock to`,
      { productColorRateId, size, requestedQuantity: quantity, availableQuantity: 0 }
    );
  }

  productSize.quantity += quantity;
  await productSize.save({ transaction });
  return productSize;
}

// Add newly-received stock for an exact productColorRateId + size. Unlike
// restoreExactStock, this is allowed to create the ProductSize row if the
// shop has never carried this exact size/color before - receiving stock is
// exactly the moment a new size might be introduced, so there's nothing to
// "restore" yet.
async function receiveStock(productColorRateId, size, quantity, transaction) {
  const [productSize] = await ProductSize.findOrCreate({
    where: { productColorRateId, size },
    defaults: { productColorRateId, size, quantity: 0 },
    transaction
  });

  productSize.quantity += quantity;
  await productSize.save({ transaction });
  return productSize;
}

module.exports = {
  InsufficientStockError,
  deductExactStock,
  restoreExactStock,
  receiveStock
};
