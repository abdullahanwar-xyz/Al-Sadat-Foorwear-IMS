const BaseController = require('./baseController');
const ProductColorRate = require('../models/ProductColorRate');
const Product = require('../models/Product');

class ProductColorRateController extends BaseController {
  constructor() {
    super(ProductColorRate);
  }

  // Get all product color rates
  getAllProductColorRates = async (req, res) => {
    try {
      const colorRates = await ProductColorRate.findAll();
      res.status(200).json(colorRates);
    } catch (error) {
      console.error('Error fetching color rates:', error);
      res.status(500).json({ message: 'Failed to fetch color rates', error: error.message });
    }
  };

  // Get product color rate by ID
  getProductColorRateById = async (req, res) => {
    try {
      const { id } = req.params;
      const colorRate = await ProductColorRate.findByPk(id);
      
      if (!colorRate) {
        return res.status(404).json({ message: 'Color rate not found' });
      }
      
      res.status(200).json(colorRate);
    } catch (error) {
      console.error('Error fetching color rate:', error);
      res.status(500).json({ message: 'Failed to fetch color rate', error: error.message });
    }
  };

  // Get color rates by product ID
  getByProductId = async (req, res) => {
    try {
      const { productId } = req.params;
      
      const colorRates = await ProductColorRate.findAll({
        where: { productId },
      });
      
      res.status(200).json(colorRates);
    } catch (error) {
      console.error('Error fetching color rates by product ID:', error);
      res.status(500).json({ message: 'Failed to fetch color rates', error: error.message });
    }
  };

  // Create a new product color rate
  createProductColorRate = async (req, res) => {
    try {
      const { productId, color, rate } = req.body;
      
      if (!productId || !color || !rate) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const colorRate = await ProductColorRate.create({
        productId,
        color,
        rate: parseFloat(rate)
      });
      
      res.status(201).json(colorRate);
    } catch (error) {
      console.error('Error creating color rate:', error);
      res.status(500).json({ message: 'Failed to create color rate', error: error.message });
    }
  };

  // Update product color rate
  updateProductColorRate = async (req, res) => {
    try {
      const { id } = req.params;
      const { color, rate } = req.body;
      
      const colorRate = await ProductColorRate.findByPk(id);
      
      if (!colorRate) {
        return res.status(404).json({ message: 'Color rate not found' });
      }
      
      await colorRate.update({
        ...(color && { color }),
        ...(rate && { rate: parseFloat(rate) })
      });
      
      res.status(200).json(await ProductColorRate.findByPk(id));
    } catch (error) {
      console.error('Error updating color rate:', error);
      res.status(500).json({ message: 'Failed to update color rate', error: error.message });
    }
  };

  // Delete product color rate
  deleteProductColorRate = async (req, res) => {
    try {
      const { id } = req.params;
      const colorRate = await ProductColorRate.findByPk(id);
      
      if (!colorRate) {
        return res.status(404).json({ message: 'Color rate not found' });
      }
      
      await colorRate.destroy();
      
      res.status(200).json({ message: 'Color rate deleted successfully' });
    } catch (error) {
      console.error('Error deleting color rate:', error);
      res.status(500).json({ message: 'Failed to delete color rate', error: error.message });
    }
  };
}

module.exports = new ProductColorRateController();
