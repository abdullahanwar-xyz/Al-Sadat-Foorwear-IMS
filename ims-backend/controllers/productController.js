const Product = require('../models/Product');
const ProductColorRate = require('../models/ProductColorRate');
const ProductSize = require('../models/ProductSize');
const InvoiceItem = require('../models/InvoiceItem');
const { Op } = require('sequelize'); // Import Sequelize operators directly

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [
        { 
          model: ProductColorRate, 
          as: 'colorRates',
          include: [
            { model: ProductSize, as: 'sizes' }
          ]
        }
      ]
    });
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      include: [
        { 
          model: ProductColorRate, 
          as: 'colorRates',
          include: [
            { model: ProductSize, as: 'sizes' }
          ]
        }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, thickness, collection, commission_percentage, colorRates } = req.body;

    if (!name || !thickness || !collection) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Start a transaction to ensure product, color rates, and sizes are created together
    const result = await Product.sequelize.transaction(async (t) => {
      // Create the product
      const product = await Product.create({
        name,
        thickness,
        collection,
        commission_percentage: commission_percentage !== undefined ? parseFloat(commission_percentage) : 0
      }, { transaction: t });

      // Create multiple color rates with their sizes if provided
      if (Array.isArray(colorRates) && colorRates.length > 0) {
        const validColorRates = colorRates.filter(cr => cr.color && cr.rate);
        
        if (validColorRates.length > 0) {
          // Create each color rate and its sizes
          for (const colorRateData of validColorRates) {
            const colorRate = await ProductColorRate.create({
              productId: product.id,
              color: colorRateData.color,
              rate: parseFloat(colorRateData.rate),
              imageUrl: colorRateData.imageUrl || null
            }, { transaction: t });

            // Create sizes for this color rate if provided
            if (Array.isArray(colorRateData.sizes) && colorRateData.sizes.length > 0) {
              const validSizes = colorRateData.sizes.filter(s => s.size && s.quantity !== undefined);
              
              if (validSizes.length > 0) {
                await ProductSize.bulkCreate(
                  validSizes.map(s => ({
                    productColorRateId: colorRate.id,
                    size: parseFloat(s.size),
                    quantity: parseInt(s.quantity),
                    unit: s.unit || 'feet'
                  })),
                  { transaction: t }
                );
              }
            }
          }
        }
      } 
      // Backward compatibility for single color rate
      else if (req.body.category && req.body.rate) {
        await ProductColorRate.create({
          productId: product.id,
          color: req.body.category,
          rate: parseFloat(req.body.rate)
        }, { transaction: t });
      }

      return { product };
    });

    // Return the created product with its color rates and sizes
    const createdProduct = await Product.findByPk(result.product.id, {
      include: [
        { 
          model: ProductColorRate, 
          as: 'colorRates',
          include: [
            { model: ProductSize, as: 'sizes' }
          ]
        }
      ]
    });

    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, thickness, collection, commission_percentage, is_active, colorRates } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.sequelize.transaction(async (t) => {
      // Update product details
      if (name || thickness || collection || commission_percentage !== undefined || is_active !== undefined) {
        await product.update({
          ...(name && { name }),
          ...(thickness && { thickness }),
          ...(collection && { collection }),
          ...(commission_percentage !== undefined && { commission_percentage: parseFloat(commission_percentage) }),
          ...(is_active !== undefined && { is_active })
        }, { transaction: t });
      }
      
      // Update color rates with their sizes if provided
      if (Array.isArray(colorRates) && colorRates.length > 0) {
        const validColorRates = colorRates.filter(cr => cr.color && cr.rate);
        
        if (validColorRates.length > 0) {
          // Get existing color rates for this product
          const existingColorRates = await ProductColorRate.findAll({
            where: { productId: id },
            include: [{ model: ProductSize, as: 'sizes' }],
            transaction: t
          });
          
          // Process each color rate and its sizes
          for (const colorRateData of validColorRates) {
            let colorRate = existingColorRates.find(er => er.color === colorRateData.color);
            
            if (colorRate) {
              // Update existing color rate if rate or image has changed
              const newImageUrl = colorRateData.imageUrl || null;
              if (colorRate.rate !== parseFloat(colorRateData.rate) || colorRate.imageUrl !== newImageUrl) {
                await colorRate.update({
                  rate: parseFloat(colorRateData.rate),
                  imageUrl: newImageUrl
                }, { transaction: t });
              }
            } else {
              // Create new color rate if it doesn't exist
              colorRate = await ProductColorRate.create({
                productId: id,
                color: colorRateData.color,
                rate: parseFloat(colorRateData.rate),
                imageUrl: colorRateData.imageUrl || null
              }, { transaction: t });
            }

            // Handle sizes for this color rate
            if (Array.isArray(colorRateData.sizes) && colorRateData.sizes.length > 0) {
              const validSizes = colorRateData.sizes.filter(s => s.size && s.quantity !== undefined);
              
              if (validSizes.length > 0) {
                // Get existing sizes for this color rate
                const existingSizes = await ProductSize.findAll({
                  where: { productColorRateId: colorRate.id },
                  transaction: t
                });
                
                // Process each size
                for (const sizeData of validSizes) {
                  const existingSize = existingSizes.find(es => es.size === parseFloat(sizeData.size));
                  
                  if (existingSize) {
                    // Update existing size if quantity or unit has changed
                    if (existingSize.quantity !== parseInt(sizeData.quantity) || existingSize.unit !== (sizeData.unit || 'feet')) {
                      await existingSize.update({
                        quantity: parseInt(sizeData.quantity),
                        unit: sizeData.unit || 'feet'
                      }, { transaction: t });
                    }
                  } else {
                    // Create new size if it doesn't exist
                    await ProductSize.create({
                      productColorRateId: colorRate.id,
                      size: parseFloat(sizeData.size),
                      quantity: parseInt(sizeData.quantity),
                      unit: sizeData.unit || 'feet'
                    }, { transaction: t });
                  }
                }
                
                // Remove sizes that weren't included in the update
                const sizesToKeep = validSizes.map(s => parseFloat(s.size));
                await ProductSize.destroy({
                  where: {
                    productColorRateId: colorRate.id,
                    size: {
                      [Op.notIn]: sizesToKeep
                    }
                  },
                  transaction: t
                });
              } else {
                // If no valid sizes, remove all sizes for this color rate
                await ProductSize.destroy({
                  where: { productColorRateId: colorRate.id },
                  transaction: t
                });
              }
            } else {
              // If no sizes provided, remove all sizes for this color rate
              await ProductSize.destroy({
                where: { productColorRateId: colorRate.id },
                transaction: t
              });
            }
          }
          
          // Remove color rates (and their sizes) that weren't included in the update
          const colorNamesToKeep = validColorRates.map(cr => cr.color);
          const colorRatesToDelete = await ProductColorRate.findAll({
            where: {
              productId: id,
              color: {
                [Op.notIn]: colorNamesToKeep
              }
            },
            transaction: t
          });

          // Delete sizes for color rates that will be deleted
          for (const colorRateToDelete of colorRatesToDelete) {
            await ProductSize.destroy({
              where: { productColorRateId: colorRateToDelete.id },
              transaction: t
            });
          }

          // Delete the color rates
          await ProductColorRate.destroy({
            where: {
              productId: id,
              color: {
                [Op.notIn]: colorNamesToKeep
              }
            },
            transaction: t
          });
        }
      }
      // Backward compatibility for single color rate
      else if (req.body.category && req.body.rate) {
        const [colorRate] = await ProductColorRate.findOrCreate({
          where: { 
            productId: id,
            color: req.body.category
          },
          defaults: {
            productId: id,
            color: req.body.category,
            rate: parseFloat(req.body.rate)
          },
          transaction: t
        });
        
        if (colorRate && colorRate.rate !== parseFloat(req.body.rate)) {
          await colorRate.update({
            rate: parseFloat(req.body.rate)
          }, { transaction: t });
        }
      }
    });
    
    // Get updated product with color rates and sizes
    const updatedProduct = await Product.findByPk(id, {
      include: [
        { 
          model: ProductColorRate, 
          as: 'colorRates',
          include: [
            { model: ProductSize, as: 'sizes' }
          ]
        }
      ]
    });
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

// Delete a product - only when it has zero real history. A product with
// any invoice item is never cascade-deleted (that used to destroy every
// InvoiceItem/ProductSize/ProductColorRate along with it via a ?force=true
// bypass, permanently losing real sales history); instead it's archived
// via is_active, the same dependency-blocks-delete pattern already used
// for Suppliers/Customers.
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const colorRates = await ProductColorRate.findAll({
      where: { productId: id }
    });
    const colorRateIds = colorRates.map(cr => cr.id);

    const invoiceItemsByProduct = await InvoiceItem.count({
      where: { productId: id }
    });

    const invoiceItemsByColorRate = colorRateIds.length > 0
      ? await InvoiceItem.count({
          where: {
            productColorRateId: {
              [Op.in]: colorRateIds
            }
          }
        })
      : 0;

    const totalInvoiceItems = invoiceItemsByProduct + invoiceItemsByColorRate;

    if (totalInvoiceItems > 0) {
      return res.status(400).json({
        message: `Cannot delete this product: it has ${totalInvoiceItems} invoice item(s) on record. Archive the product instead to preserve that history.`,
        hasHistory: true,
        dependencies: {
          invoiceItems: totalInvoiceItems
        }
      });
    }

    await Product.sequelize.transaction(async (t) => {
      if (colorRateIds.length > 0) {
        await ProductSize.destroy({
          where: { productColorRateId: { [Op.in]: colorRateIds } },
          transaction: t
        });
      }
      await ProductColorRate.destroy({ where: { productId: id }, transaction: t });
      await product.destroy({ transaction: t });
    });

    res.status(200).json({
      message: 'Product deleted successfully',
      deletedProduct: product
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

// Get product dependencies (what would be affected by deletion)
exports.getProductDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get all color rates for this product
    const colorRates = await ProductColorRate.findAll({
      where: { productId: id },
      include: [{ model: ProductSize, as: 'sizes' }]
    });
    
    const colorRateIds = colorRates.map(cr => cr.id);
    
    // Count dependencies
    const invoiceItemsByProduct = await InvoiceItem.count({
      where: { productId: id }
    });
    
    const invoiceItemsByColorRate = colorRateIds.length > 0 
      ? await InvoiceItem.count({
          where: { 
            productColorRateId: {
              [Op.in]: colorRateIds
            }
          }
        })
      : 0;
    
    const productSizes = colorRateIds.length > 0
      ? await ProductSize.count({
          where: { 
            productColorRateId: {
              [Op.in]: colorRateIds
            }
          }
        })
      : 0;
    
    const dependencies = {
      product: product,
      colorRates: colorRates.length,
      productSizes: productSizes,
      invoiceItems: invoiceItemsByProduct + invoiceItemsByColorRate,
      canDelete: (invoiceItemsByProduct + invoiceItemsByColorRate) === 0,
      details: {
        colorRatesData: colorRates,
        invoiceItemsByProduct: invoiceItemsByProduct,
        invoiceItemsByColorRate: invoiceItemsByColorRate,
        totalInvoiceItems: invoiceItemsByProduct + invoiceItemsByColorRate
      }
    };
    
    res.status(200).json(dependencies);
  } catch (error) {
    console.error('Error checking product dependencies:', error);
    res.status(500).json({ message: 'Failed to check dependencies', error: error.message });
  }
};

// Get products by category
exports.getByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const products = await Product.findAll({
      include: [{
        model: ProductColorRate,
        as: 'colorRates',
        where: { color: category }
      }]
    });
    
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// Look up a single item by its ProductSize id (used by QR/barcode scanning:
// the QR code encodes this id directly, so scanning is a one-shot lookup).
exports.lookupProductSize = async (req, res) => {
  try {
    const { id } = req.params;

    const productSize = await ProductSize.findByPk(id, {
      include: [
        {
          model: ProductColorRate,
          as: 'productColorRate',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    if (!productSize || !productSize.productColorRate || !productSize.productColorRate.product) {
      return res.status(404).json({ message: 'No item found for this code' });
    }

    const colorRate = productSize.productColorRate;
    const product = colorRate.product;

    res.status(200).json({
      productSizeId: productSize.id,
      productId: product.id,
      productName: product.name,
      collection: product.collection,
      productColorRateId: colorRate.id,
      color: colorRate.color,
      rate: colorRate.rate,
      size: productSize.size,
      quantity: productSize.quantity,
    });
  } catch (error) {
    console.error('Error looking up product size:', error);
    res.status(500).json({ message: 'Failed to look up item', error: error.message });
  }
};
