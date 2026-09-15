const Supplier = require('../models/Supplier');
const SupplierTransaction = require('../models/SupplierTransaction');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

// Get all suppliers
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      order: [['created_at', 'DESC']]
    });

    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ message: 'Error fetching suppliers', error: error.message });
  }
};

// Get single supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id, {
      include: [
        {
          model: SupplierTransaction,
          as: 'transactions',
          limit: 10,
          order: [['transaction_date', 'DESC']],
          attributes: ['trans_id', 'type', 'total_amount', 'amount_paid', 'description', 'transaction_date']
        }
      ]
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ message: 'Error fetching supplier', error: error.message });
  }
};

// Create new supplier
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, address, opening_balance, notes } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const supplier = await Supplier.create({
      name,
      phone,
      address,
      opening_balance: opening_balance || 0.00,
      current_balance: opening_balance || 0.00, // Initialize current balance with opening balance
      notes,
      status: 'active'
    });

    res.status(201).json({ message: 'Supplier created successfully', supplier });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ message: 'Error creating supplier', error: error.message });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, opening_balance, status, notes } = req.body;

    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Calculate balance adjustment if opening balance changed
    let balanceAdjustment = 0;
    if (opening_balance !== undefined && opening_balance !== supplier.opening_balance) {
      balanceAdjustment = parseFloat(opening_balance) - parseFloat(supplier.opening_balance);
    }

    await supplier.update({
      name: name || supplier.name,
      phone: phone !== undefined ? phone : supplier.phone,
      address: address !== undefined ? address : supplier.address,
      opening_balance: opening_balance !== undefined ? opening_balance : supplier.opening_balance,
      current_balance: balanceAdjustment !== 0
        ? parseFloat(supplier.current_balance) + balanceAdjustment
        : supplier.current_balance,
      status: status || supplier.status,
      notes: notes !== undefined ? notes : supplier.notes
    });

    res.json({ message: 'Supplier updated successfully', supplier });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ message: 'Error updating supplier', error: error.message });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id, {
      include: [{ model: SupplierTransaction, as: 'transactions' }]
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Check if supplier has transactions
    if (supplier.transactions && supplier.transactions.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete supplier with existing transactions. Please delete transactions first.'
      });
    }

    await supplier.destroy();
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ message: 'Error deleting supplier', error: error.message });
  }
};

// Get supplier ledger (all transactions)
exports.getSupplierLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const whereClause = { supplier_id: id };

    if (startDate && endDate) {
      whereClause.transaction_date = {
        [Op.between]: [startDate, endDate]
      };
    }

    const transactions = await SupplierTransaction.findAll({
      where: whereClause,
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      supplier: {
        supplier_id: supplier.supplier_id,
        name: supplier.name,
        opening_balance: supplier.opening_balance,
        current_balance: supplier.current_balance
      },
      transactions
    });
  } catch (error) {
    console.error('Error fetching supplier ledger:', error);
    res.status(500).json({ message: 'Error fetching supplier ledger', error: error.message });
  }
};
