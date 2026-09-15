const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

async function ensureWindowTables() {
  console.log('🔧 Ensuring all window-related tables exist...');
  
  try {
    const queryInterface = sequelize.getQueryInterface();
    
    // Check which tables exist
    const [tables] = await sequelize.query(`
      SELECT name FROM sqlite_master WHERE type='table' 
      AND name IN (
        'window_calculations', 
        'window_settings', 
        'window_invoice_settings', 
        'window_invoices', 
        'window_invoice_items', 
        'window_invoice_payments'
      )
    `);
    
    const existingTables = tables.map(t => t.name);
    console.log('📋 Existing window tables:', existingTables);

    // 1. Ensure window_settings table exists
    if (!existingTables.includes('window_settings')) {
      console.log('📦 Creating window_settings table...');
      await queryInterface.createTable('window_settings', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        productType: {
          type: DataTypes.STRING,
          allowNull: false
        },
        aluminiumType: {
          type: DataTypes.ENUM('J', 'C'),
          allowNull: false
        },
        lockType: {
          type: DataTypes.ENUM('Push', 'Leach'),
          allowNull: false
        },
        heightDeduction: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        widthDeduction: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        lockAddition: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log('✅ window_settings table created');
    }

    // 2. Ensure window_calculations table exists
    if (!existingTables.includes('window_calculations')) {
      console.log('📦 Creating window_calculations table...');
      await queryInterface.createTable('window_calculations', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        inputHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        inputWidth: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        productType: {
          type: DataTypes.STRING,
          allowNull: true
        },
        doorCount: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        aluminiumType: {
          type: DataTypes.ENUM('J', 'C'),
          allowNull: true
        },
        lockType: {
          type: DataTypes.ENUM('Push', 'Leach'),
          allowNull: true
        },
        doorHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        finalHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        usableHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        finalWidths: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        baseWidths: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        heightDeduction: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        widthDeduction: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        lockAddition: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        windowNumber: {
          type: DataTypes.STRING,
          allowNull: true
        },
        glassType: {
          type: DataTypes.ENUM('S', 'T'),
          allowNull: true
        },
        fixedAreaHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        useSeparateHeights: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false
        },
        leftHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        rightHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        fixedLeftHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        fixedRightHeight: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        sessionId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        windowsData: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        totalWindows: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 1
        },
        calculationResults: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log('✅ window_calculations table created');
    }

    // 3. Ensure window_invoice_settings table exists
    if (!existingTables.includes('window_invoice_settings')) {
      console.log('📦 Creating window_invoice_settings table...');
      await queryInterface.createTable('window_invoice_settings', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        thickness: {
          type: DataTypes.ENUM('0.9mm', '1.2mm', '1.6mm', '2.0mm'),
          allowNull: false
        },
        type: {
          type: DataTypes.ENUM('C', 'J'),
          allowNull: false
        },
        feedRate: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.00
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      
      // Add unique index for thickness and type combination
      try {
        await queryInterface.addIndex('window_invoice_settings', ['thickness', 'type'], {
          unique: true,
          name: 'window_invoice_settings_thickness_type_unique'
        });
        console.log('✅ Added unique index for thickness and type');
      } catch (indexError) {
        console.log('ℹ️ Index already exists or could not be created');
      }
      
      console.log('✅ window_invoice_settings table created');
    }

    // 4. Ensure window_invoices table exists
    if (!existingTables.includes('window_invoices')) {
      console.log('📦 Creating window_invoices table...');
      await queryInterface.createTable('window_invoices', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'customers',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        invoiceNumber: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_DATE')
        },
        width: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        height: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        totalFeed: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        finalFeed: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        glassFeed: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        squareFeet: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true
        },
        subtotalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0
        },
        discountPercentage: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          defaultValue: 0
        },
        discountAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0
        },
        totalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        paidAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        remainingAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        sessionId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        windowsData: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        calculationResults: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log('✅ window_invoices table created');
    }

    // 5. Ensure window_invoice_payments table exists
    if (!existingTables.includes('window_invoice_payments')) {
      console.log('📦 Creating window_invoice_payments table...');
      await queryInterface.createTable('window_invoice_payments', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        windowInvoiceId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'window_invoices',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        paymentDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_DATE')
        },
        paymentMethod: {
          type: DataTypes.ENUM('Cash', 'Card', 'Bank Transfer', 'Check', 'UPI'),
          allowNull: false,
          defaultValue: 'Cash'
        },
        reference: {
          type: DataTypes.STRING,
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log('✅ window_invoice_payments table created');
    }

    // 6. Ensure window_invoice_items table exists
    if (!existingTables.includes('window_invoice_items')) {
      console.log('📦 Creating window_invoice_items table...');
      await queryInterface.createTable('window_invoice_items', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        windowInvoiceId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'window_invoices',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        windowNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        width: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        height: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        squareFeet: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        rate: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        glassAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0
        },
        totalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log('✅ window_invoice_items table created');
    }

    // Ensure required columns exist in window_calculations
    await ensureWindowCalculationColumns();
    
    // Ensure required columns exist in window_invoices
    await ensureWindowInvoiceColumns();
    
    console.log('✅ All window tables verified and ready');
    
  } catch (error) {
    console.error('❌ Failed to ensure window tables:', error);
    throw error;
  }
}

async function ensureWindowCalculationColumns() {
  try {
    const [columns] = await sequelize.query(`PRAGMA table_info(window_calculations)`);
    const existingColumns = columns.map(c => c.name);

    const requiredColumns = [
      { name: 'baseWidths', type: 'TEXT', allowNull: true },
      { name: 'windowNumber', type: 'VARCHAR(255)', allowNull: true },
      { name: 'glassType', type: 'VARCHAR(255)', allowNull: true },
      { name: 'useSeparateHeights', type: 'BOOLEAN', allowNull: true, defaultValue: false },
      { name: 'leftHeight', type: 'DECIMAL(10,2)', allowNull: true },
      { name: 'rightHeight', type: 'DECIMAL(10,2)', allowNull: true },
      { name: 'fixedLeftHeight', type: 'DECIMAL(10,2)', allowNull: true },
      { name: 'fixedRightHeight', type: 'DECIMAL(10,2)', allowNull: true },
      { name: 'sessionId', type: 'VARCHAR(255)', allowNull: true },
      { name: 'windowsData', type: 'TEXT', allowNull: true },
      { name: 'totalWindows', type: 'INTEGER', allowNull: true, defaultValue: 1 },
      { name: 'calculationResults', type: 'TEXT', allowNull: true },
      { name: 'fixedAreaHeight', type: 'DECIMAL(10,2)', allowNull: true },
      { name: 'usableHeight', type: 'DECIMAL(10,2)', allowNull: true }
    ];

    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`📝 Adding missing column: window_calculations.${column.name}`);
        try {
          const defaultClause = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
          await sequelize.query(`
            ALTER TABLE window_calculations 
            ADD COLUMN ${column.name} ${column.type} ${column.allowNull ? 'NULL' : 'NOT NULL'}${defaultClause}
          `);
        } catch (error) {
          if (!error.message.includes('duplicate column name')) {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error ensuring window calculation columns:', error);
  }
}

async function ensureWindowInvoiceColumns() {
  try {
    const [tables] = await sequelize.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='window_invoices'
    `);
    
    if (tables.length > 0) {
      const [columns] = await sequelize.query(`PRAGMA table_info(window_invoices)`);
      const existingColumns = columns.map(c => c.name);

      const requiredColumns = [
        { name: 'subtotalAmount', type: 'DECIMAL(10,2)', allowNull: true, defaultValue: 0 },
        { name: 'discountPercentage', type: 'DECIMAL(5,2)', allowNull: true, defaultValue: 0 },
        { name: 'discountAmount', type: 'DECIMAL(10,2)', allowNull: true, defaultValue: 0 },
        { name: 'sessionId', type: 'VARCHAR(255)', allowNull: true },
        { name: 'windowsData', type: 'TEXT', allowNull: true },
        { name: 'calculationResults', type: 'TEXT', allowNull: true }
      ];
      
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name)) {
          console.log(`📝 Adding missing column: window_invoices.${column.name}`);
          try {
            const defaultClause = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
            await sequelize.query(`
              ALTER TABLE window_invoices 
              ADD COLUMN ${column.name} ${column.type} ${column.allowNull ? 'NULL' : 'NOT NULL'}${defaultClause}
            `);
          } catch (error) {
            if (!error.message.includes('duplicate column name')) {
              console.error(`❌ Error adding column ${column.name}:`, error.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error ensuring window invoice columns:', error);
  }
}

module.exports = ensureWindowTables;