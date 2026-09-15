const BaseController = require('./baseController');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

class CustomerController extends BaseController {
  constructor() {
    super(Customer);
  }

  // Get a single customer by id
  getById = async (req, res) => {
    try {
      const customer = await this.model.findByPk(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      return res.status(200).json(customer);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Get customer with all invoices
  getWithInvoices = async (req, res) => {
    try {
      // Use customerId parameter name instead of id
      const customer = await this.model.findByPk(req.params.customerId, {
        include: [Invoice]
      });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      return res.status(200).json(customer);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Search customers by name or contact
  searchCustomers = async (req, res) => {
    try {
      const { term } = req.query;
      const customers = await this.model.findAll({
        where: {
          [this.model.sequelize.Op.or]: [
            { name: { [this.model.sequelize.Op.like]: `%${term}%` } },
            { phone: { [this.model.sequelize.Op.like]: `%${term}%` } },
            { email: { [this.model.sequelize.Op.like]: `%${term}%` } }
          ]
        }
      });
      return res.status(200).json(customers);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
  
  // Override create to validate customer data
  create = async (req, res) => {
    try {
      // Check if required fields are provided
      if (!req.body.name) {
        return res.status(400).json({ message: 'Customer name is required' });
      }
      
      // Check if customer with same email already exists (if email provided)
      if (req.body.email) {
        const existingCustomer = await this.model.findOne({
          where: { email: req.body.email }
        });
        
        if (existingCustomer) {
          return res.status(400).json({ 
            message: 'A customer with this email already exists' 
          });
        }
      }
      
      const customer = await this.model.create(req.body);
      return res.status(201).json(customer);
    } catch (error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };
  
  // Override update to check for existing customers with same email
  update = async (req, res) => {
    try {
      // Check if customer exists
      const customer = await this.model.findByPk(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      // Check if email is being updated and if it would conflict with another customer
      if (req.body.email && req.body.email !== customer.email) {
        const existingCustomer = await this.model.findOne({
          where: { 
            email: req.body.email,
            id: { [this.model.sequelize.Op.ne]: req.params.id }
          }
        });
        
        if (existingCustomer) {
          return res.status(400).json({ 
            message: 'Another customer with this email already exists' 
          });
        }
      }
      
      const [updated] = await this.model.update(req.body, {
        where: { id: req.params.id }
      });
      
      if (!updated) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      const updatedCustomer = await this.model.findByPk(req.params.id);
      return res.status(200).json(updatedCustomer);
    } catch (error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };
  
  // Delete a customer - only when it has zero real history. A customer
  // with any invoice is never cascade-deleted (that used to destroy every
  // Payment/InvoiceItem/Invoice along with it, permanently losing real
  // sales history); instead it's archived via is_active, the same
  // dependency-blocks-delete pattern already used for Suppliers/Companies.
  delete = async (req, res) => {
    try {
      const customer = await this.model.findByPk(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const invoiceCount = await Invoice.count({
        where: { customerId: req.params.id }
      });

      if (invoiceCount > 0) {
        return res.status(400).json({
          message: `Cannot delete this customer: they have ${invoiceCount} invoice(s) on record. Archive the customer instead to preserve that history.`,
          hasHistory: true,
          invoiceCount
        });
      }

      await this.model.destroy({ where: { id: req.params.id } });
      return res.status(200).json({
        message: 'Customer deleted successfully',
        deletedCustomer: customer
      });
    } catch (error) {
      console.error('Delete customer error:', error);
      return res.status(500).json({
        message: 'Failed to delete customer',
        error: error.message
      });
    }
  };
  
  // Get all customers with pagination and sorting
  getAll = async (req, res) => {
    try {
      const { page = 1, sortBy = 'name', sortOrder = 'ASC' } = req.query;
      const offset = (page - 1) ;
      
      const customers = await this.model.findAndCountAll({
        offset: parseInt(offset),
        order: [[sortBy, sortOrder]],
      });
      
      return res.status(200).json({
        totalItems: customers.count,
        customers: customers.rows,
        totalPages: Math.ceil(customers.count ),
        currentPage: page
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new CustomerController();
