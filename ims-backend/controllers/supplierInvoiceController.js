const SupplierInvoice = require('../models/SupplierInvoice');
const Supplier = require('../models/Supplier');
const User = require('../models/user');
const { Op } = require('sequelize');

// SupplierInvoice is a standalone record of a supplier's own invoice
// document (invoice number, total, due date) - it does NOT affect
// Supplier.current_balance. That balance has exactly one source of truth:
// SupplierTransaction (see supplierTransactionController.js), which is what
// Suppliers/Transactions actually create, display, and reverse on delete.
// A recordPayment endpoint used to live here and decrement current_balance
// directly, independent of SupplierTransaction - it was removed because
// nothing in the app called it and it could silently desync the real
// balance with no bank/cash ledger trace. Do not reintroduce a
// current_balance write here; record a SupplierTransaction instead.

// Get all supplier invoices with filtering
const getAllSupplierInvoices = async (req, res) => {
  try {
    const {
      supplier_id,
      status,
      start_date,
      end_date
    } = req.query;

    const where = {};

    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    if (status) {
      where.status = status;
    }

    if (start_date && end_date) {
      where.invoice_date = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      where.invoice_date = {
        [Op.gte]: start_date
      };
    } else if (end_date) {
      where.invoice_date = {
        [Op.lte]: end_date
      };
    }

    const invoices = await SupplierInvoice.findAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone', 'address']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ],
      order: [['invoice_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching supplier invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier invoices',
      error: error.message
    });
  }
};

// Get supplier invoice by ID
const getSupplierInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await SupplierInvoice.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone', 'address', 'current_balance']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching supplier invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier invoice',
      error: error.message
    });
  }
};

// Create new supplier invoice
const createSupplierInvoice = async (req, res) => {
  try {
    const {
      supplier_id,
      invoice_number,
      invoice_date,
      total_amount,
      paid_amount = 0,
      description,
      due_date
    } = req.body;

    // Validate required fields
    if (!supplier_id || !invoice_number || !invoice_date || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'Supplier, invoice number, invoice date, and total amount are required'
      });
    }

    // Validate supplier exists
    const supplier = await Supplier.findByPk(supplier_id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if invoice number already exists for this supplier
    const existingInvoice = await SupplierInvoice.findOne({
      where: {
        supplier_id,
        invoice_number
      }
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists for this supplier'
      });
    }

    const invoice = await SupplierInvoice.create({
      supplier_id,
      invoice_number,
      invoice_date,
      total_amount,
      paid_amount,
      description,
      due_date,
      created_by: req.user.user_id
    });

    const createdInvoice = await SupplierInvoice.findByPk(invoice.invoice_id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Supplier invoice created successfully',
      data: createdInvoice
    });
  } catch (error) {
    console.error('Error creating supplier invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating supplier invoice',
      error: error.message
    });
  }
};

// Update supplier invoice
const updateSupplierInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoice_number,
      invoice_date,
      total_amount,
      paid_amount,
      description,
      due_date
    } = req.body;

    const invoice = await SupplierInvoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }

    // Check if invoice number is being changed and if it already exists
    if (invoice_number && invoice_number !== invoice.invoice_number) {
      const existingInvoice = await SupplierInvoice.findOne({
        where: {
          supplier_id: invoice.supplier_id,
          invoice_number,
          invoice_id: { [Op.ne]: id }
        }
      });

      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: 'Invoice number already exists for this supplier'
        });
      }
    }

    await invoice.update({
      invoice_number,
      invoice_date,
      total_amount,
      paid_amount,
      description,
      due_date
    });

    const updatedInvoice = await SupplierInvoice.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'user_name', 'user_username']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Supplier invoice updated successfully',
      data: updatedInvoice
    });
  } catch (error) {
    console.error('Error updating supplier invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating supplier invoice',
      error: error.message
    });
  }
};

// Delete supplier invoice
const deleteSupplierInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await SupplierInvoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Supplier invoice not found'
      });
    }

    await invoice.destroy();

    res.json({
      success: true,
      message: 'Supplier invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting supplier invoice',
      error: error.message
    });
  }
};

// Get pending invoices (for payables report)
const getPendingInvoices = async (req, res) => {
  try {
    const { supplier_id } = req.query;

    const where = {
      status: {
        [Op.in]: ['pending', 'partial']
      }
    };

    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    const invoices = await SupplierInvoice.findAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_id', 'name', 'phone', 'address']
        }
      ],
      order: [['due_date', 'ASC'], ['invoice_date', 'DESC']]
    });

    const totalPending = invoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.pending_amount);
    }, 0);

    res.json({
      success: true,
      data: {
        invoices,
        total_pending: totalPending,
        count: invoices.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending invoices',
      error: error.message
    });
  }
};

// Get supplier invoice statistics
const getSupplierInvoiceStats = async (req, res) => {
  try {
    const { supplier_id, start_date, end_date } = req.query;

    const where = {};

    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    if (start_date && end_date) {
      where.invoice_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const stats = await SupplierInvoice.findOne({
      where,
      attributes: [
        [SupplierInvoice.sequelize.fn('SUM', SupplierInvoice.sequelize.col('total_amount')), 'total_invoiced'],
        [SupplierInvoice.sequelize.fn('SUM', SupplierInvoice.sequelize.col('paid_amount')), 'total_paid'],
        [SupplierInvoice.sequelize.fn('SUM', SupplierInvoice.sequelize.col('pending_amount')), 'total_pending'],
        [SupplierInvoice.sequelize.fn('COUNT', SupplierInvoice.sequelize.col('invoice_id')), 'total_count']
      ]
    });

    // Get count by status
    const statusCounts = await SupplierInvoice.findAll({
      where,
      attributes: [
        'status',
        [SupplierInvoice.sequelize.fn('COUNT', SupplierInvoice.sequelize.col('invoice_id')), 'count']
      ],
      group: ['status']
    });

    res.json({
      success: true,
      data: {
        ...stats.dataValues,
        status_breakdown: statusCounts
      }
    });
  } catch (error) {
    console.error('Error fetching supplier invoice statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier invoice statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllSupplierInvoices,
  getSupplierInvoiceById,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  getPendingInvoices,
  getSupplierInvoiceStats
};
