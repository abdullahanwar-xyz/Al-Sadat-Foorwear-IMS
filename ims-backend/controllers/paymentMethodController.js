const BaseController = require('./baseController');
const PaymentMethod = require('../models/PaymentMethod');
const { Op } = require('sequelize');

class PaymentMethodController extends BaseController {
  constructor() {
    super(PaymentMethod);
  }

  // Get all payment methods (can filter by active only)
  async getAll(req, res) {
    try {
      const { activeOnly } = req.query;
      const where = {};
      
      if (activeOnly === 'true') {
        where.status = 1;
      }

      const paymentMethods = await PaymentMethod.findAll({
        where,
        order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      });

      res.json(paymentMethods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(500).json({ message: 'Error fetching payment methods', error: error.message });
    }
  }

  // Create new payment method (Admin only)
  async create(req, res) {
    try {
      const { name, value, icon, status, displayOrder, requiresBankAccount } = req.body;

      // Validate required fields
      if (!name || !value) {
        return res.status(400).json({ message: 'Name and value are required' });
      }

      // Check for duplicate value
      const existing = await PaymentMethod.findOne({ where: { value } });
      if (existing) {
        return res.status(400).json({ message: 'Payment method with this value already exists' });
      }

      const paymentMethod = await PaymentMethod.create({
        name,
        value,
        icon: icon || 'DollarSign',
        status: status !== undefined ? status : 1,
        displayOrder: displayOrder || 0,
        requiresBankAccount: requiresBankAccount === true,
      });

      res.status(201).json(paymentMethod);
    } catch (error) {
      console.error('Error creating payment method:', error);
      res.status(500).json({ message: 'Error creating payment method', error: error.message });
    }
  }

  // Update payment method (Admin only)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, value, icon, status, displayOrder, requiresBankAccount } = req.body;

      const paymentMethod = await PaymentMethod.findByPk(id);
      if (!paymentMethod) {
        return res.status(404).json({ message: 'Payment method not found' });
      }

      // Check for duplicate value if changing
      if (value && value !== paymentMethod.value) {
        const existing = await PaymentMethod.findOne({ where: { value } });
        if (existing) {
          return res.status(400).json({ message: 'Payment method with this value already exists' });
        }
      }

      await paymentMethod.update({
        name: name !== undefined ? name : paymentMethod.name,
        value: value !== undefined ? value : paymentMethod.value,
        icon: icon !== undefined ? icon : paymentMethod.icon,
        status: status !== undefined ? status : paymentMethod.status,
        displayOrder: displayOrder !== undefined ? displayOrder : paymentMethod.displayOrder,
        requiresBankAccount: requiresBankAccount !== undefined ? requiresBankAccount === true : paymentMethod.requiresBankAccount,
      });

      res.json(paymentMethod);
    } catch (error) {
      console.error('Error updating payment method:', error);
      res.status(500).json({ message: 'Error updating payment method', error: error.message });
    }
  }

  // Delete payment method (Admin only)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const paymentMethod = await PaymentMethod.findByPk(id);
      if (!paymentMethod) {
        return res.status(404).json({ message: 'Payment method not found' });
      }

      await paymentMethod.destroy();
      res.json({ message: 'Payment method deleted successfully' });
    } catch (error) {
      console.error('Error deleting payment method:', error);
      res.status(500).json({ message: 'Error deleting payment method', error: error.message });
    }
  }

  // Toggle status (Admin only)
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;

      const paymentMethod = await PaymentMethod.findByPk(id);
      if (!paymentMethod) {
        return res.status(404).json({ message: 'Payment method not found' });
      }

      await paymentMethod.update({
        status: paymentMethod.status === 1 ? 0 : 1,
      });

      res.json(paymentMethod);
    } catch (error) {
      console.error('Error toggling payment method status:', error);
      res.status(500).json({ message: 'Error toggling status', error: error.message });
    }
  }
}

module.exports = new PaymentMethodController();
