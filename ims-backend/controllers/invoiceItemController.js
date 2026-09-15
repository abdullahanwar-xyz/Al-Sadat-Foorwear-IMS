const BaseController = require('./baseController');
const InvoiceItem = require('../models/InvoiceItem');
const Product = require('../models/Product');

class InvoiceItemController extends BaseController {
  constructor() {
    super(InvoiceItem);
  }

  // Override getAll to include product details
  getAll = async (req, res) => {
    try {
      const items = await this.model.findAll({
        include: [Product]
      });
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Get items by invoice ID
  getByInvoiceId = async (req, res) => {
    try {
      const items = await this.model.findAll({
        where: { invoiceId: req.params.invoiceId },
        include: [Product]
      });
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Update quantity of an invoice item
  updateQuantity = async (req, res) => {
    try {
      const { quantity } = req.body;
      const [updated] = await this.model.update(
        { quantity },
        { where: { id: req.params.id } }
      );
      
      if (!updated) {
        return res.status(404).json({ message: 'Invoice item not found' });
      }
      
      const item = await this.model.findByPk(req.params.id, {
        include: [Product]
      });
      
      return res.status(200).json(item);
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new InvoiceItemController();
