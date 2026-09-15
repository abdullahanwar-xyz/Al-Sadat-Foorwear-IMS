const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SupplierInvoice = sequelize.define('SupplierInvoice', {
  invoice_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'suppliers',
      key: 'supplier_id'
    },
    onDelete: 'CASCADE'
  },
  invoice_number: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  invoice_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0.01],
        msg: 'Invoice amount must be greater than 0'
      }
    },
    get() {
      const value = this.getDataValue('total_amount');
      return value ? parseFloat(value) : 0.00;
    }
  },
  paid_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const value = this.getDataValue('paid_amount');
      return value ? parseFloat(value) : 0.00;
    }
  },
  pending_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    get() {
      const value = this.getDataValue('pending_amount');
      return value ? parseFloat(value) : 0.00;
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial', 'paid'),
    defaultValue: 'pending',
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'supplier_invoices',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['supplier_id'] },
    { fields: ['invoice_number'] },
    { fields: ['invoice_date'] },
    { fields: ['status'] }
  ],
  hooks: {
    beforeSave: (invoice) => {
      // Calculate pending amount
      invoice.pending_amount = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount);
      
      // Update status based on payment
      if (invoice.paid_amount >= invoice.total_amount) {
        invoice.status = 'paid';
      } else if (invoice.paid_amount > 0) {
        invoice.status = 'partial';
      } else {
        invoice.status = 'pending';
      }
    }
  }
});

module.exports = SupplierInvoice;
