process.env.TZ = 'Asia/Karachi';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');

// Load environment variables FIRST before anything else
dotenv.config();

const path = require('path');
const { sequelize } = require('./config/db');

// Import models for sync
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const ProductColorRate = require('./models/ProductColorRate');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Payment = require('./models/Payment');
const Return = require('./models/Return');
const ReturnItem = require('./models/ReturnItem');
const ExchangeItem = require('./models/ExchangeItem');
const Refund = require('./models/Refund');
const OnlineOrder = require('./models/OnlineOrder');
const OnlineOrderSource = require('./models/OnlineOrderSource');
const User = require('./models/user');
const PaymentMethod = require('./models/PaymentMethod');

// Backend/Financial Module Models
const Supplier = require('./models/Supplier');
const SupplierTransaction = require('./models/SupplierTransaction');
const SupplierTransactionItem = require('./models/SupplierTransactionItem');
const Expense = require('./models/Expense');
const SupplierInvoice = require('./models/SupplierInvoice');

// Phase 3: Advanced Financial Models
const BankAccount = require('./models/BankAccount');
const CashFlow = require('./models/CashFlow');

// Define Backend Module Associations
Supplier.hasMany(SupplierTransaction, { foreignKey: 'supplier_id', as: 'transactions' });
SupplierTransaction.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

User.hasMany(SupplierTransaction, { foreignKey: 'created_by', sourceKey: 'user_id', as: 'supplierTransactions' });
SupplierTransaction.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });

// Expense associations
User.hasMany(Expense, { foreignKey: 'created_by', sourceKey: 'user_id', as: 'expenses' });
Expense.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });

// Supplier Invoice associations
Supplier.hasMany(SupplierInvoice, { foreignKey: 'supplier_id', as: 'invoices' });
SupplierInvoice.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

User.hasMany(SupplierInvoice, { foreignKey: 'created_by', sourceKey: 'user_id', as: 'supplierInvoices' });
SupplierInvoice.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });

// Phase 3: Bank Account & Cash Flow associations
User.hasMany(BankAccount, { foreignKey: 'created_by', sourceKey: 'user_id', as: 'bankAccounts' });
BankAccount.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });

BankAccount.hasMany(CashFlow, { foreignKey: 'account_id', as: 'cashFlows' });
CashFlow.belongsTo(BankAccount, { foreignKey: 'account_id', as: 'account' });

BankAccount.hasMany(CashFlow, { foreignKey: 'related_account_id', as: 'relatedCashFlows' });
CashFlow.belongsTo(BankAccount, { foreignKey: 'related_account_id', as: 'relatedAccount' });

User.hasMany(CashFlow, { foreignKey: 'created_by', sourceKey: 'user_id', as: 'cashFlows' });
CashFlow.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });

// Import routes individually for better error handling
const productRoutes = require('./routes/productRoutes');
const productSizeRoutes = require('./routes/productSizeRoutes');
const productColorRateRoutes = require('./routes/productColorRateRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const invoiceItemRoutes = require('./routes/invoiceItemRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const saleRoutes = require('./routes/saleRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const returnRoutes = require('./routes/returnRoutes');
const onlineOrderRoutes = require('./routes/onlineOrderRoutes');
const onlineOrderSourceRoutes = require('./routes/onlineOrderSourceRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentMethodRoutes = require('./routes/paymentMethodRoutes');

// Backend/Financial Module Routes
const supplierRoutes = require('./routes/supplierRoutes');
const supplierTransactionRoutes = require('./routes/supplierTransactionRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const supplierInvoiceRoutes = require('./routes/supplierInvoiceRoutes');

// Phase 3: Advanced Financial Routes
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const cashFlowRoutes = require('./routes/cashFlowRoutes');
const businessReportsRoutes = require('./routes/businessReports');

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
const allowedOrigin = process.env.ALLOWED_ORIGINS || "'self'";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", allowedOrigin],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS: allow the local Vite dev server to call this API directly during development
// (in production the built frontend is served from this same origin via the static
// file handler below, so no cross-origin grant is needed there). Scoped to known
// local dev origins only — not a general allow-all.
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || devOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

// API responses are dynamic and must never be served stale from the
// browser's HTTP cache - without this, a refetch (window focus, polling)
// can silently return a cached body even though react-query correctly
// triggered a new request, which defeats the point of refetching at all.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Mount API routes individually instead of using index.js
app.use('/api/products', productRoutes);
app.use('/api/product-sizes', productSizeRoutes);
app.use('/api/product-color-rates', productColorRateRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/invoice-items', invoiceItemRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/online-order-sources', onlineOrderSourceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);

// Backend/Financial Module Routes
app.use('/api/backend/suppliers', supplierRoutes);
app.use('/api/backend/transactions', supplierTransactionRoutes);
app.use('/api/backend/expenses', expenseRoutes);
app.use('/api/backend/supplier-invoices', supplierInvoiceRoutes);

// Phase 3: Advanced Financial Routes
app.use('/api/backend/bank-accounts', bankAccountRoutes);
app.use('/api/backend/cash-flows', cashFlowRoutes);
app.use('/api/backend/business-reports', businessReportsRoutes);

// Serve uploaded files (e.g. product color rate photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Determine the correct path for static files
const staticPath = path.join(__dirname, 'dist');
console.log('Serving static files from:', staticPath);

// Serve React Frontend Static Files with explicit Content-Type headers
app.use(
  express.static(staticPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    },
  })
);

// Serve the React app for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync database models (auto-create tables from models)
    console.log('📊 Syncing database models...');
    await sequelize.sync({ force: false, alter: false });
    console.log('✅ Database models synced successfully.');

    // Create default admin user if not exists
    try {
      const existingAdmin = await User.findOne({
        where: { user_username: 'admin' }
      });
      console.log('🔍 Checking for existing admin user...', existingAdmin ? existingAdmin : 'Not found');
      if (!existingAdmin) {
        await User.create({
          user_name: 'Admin',
          user_username: 'admin',
          user_password: 'asdf@112',
          user_email: 'admin@alusoft.com',
          user_type: 'SuperAdmin', 
          user_status: 1
        });
        console.log('✅ Default SuperAdmin user created!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   Username: admin');
        console.log('   Password: asdf@112');
        console.log('   Email:    admin@alusoft.com');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (error) {
      console.error('Error creating default admin:', error.message);
    }

    // Seed default payment methods if not exists
    try {
      const seedPaymentMethods = require('./scripts/seedPaymentMethods');
      await seedPaymentMethods();
    } catch (error) {
      console.error('Error seeding payment methods:', error.message);
    }

    // Seed default Walk-in Customer if not exists (used by Record Sale)
    try {
      const seedWalkInCustomer = require('./scripts/seedWalkInCustomer');
      await seedWalkInCustomer();
    } catch (error) {
      console.error('Error seeding Walk-in Customer:', error.message);
    }

    // Start server only if not running under LiteSpeed Web Server
    // LiteSpeed manages the server lifecycle and calling listen() is not allowed
    const isLiteSpeed = process.env.LSWS_ENABLE_NODE || 
                        process.env.LITESPEED_ENABLED || 
                        process.execPath.includes('lsnode') ||
                        process.argv[0].includes('lsnode');
    
    if (!isLiteSpeed) {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } else {
      console.log(`🚀 Server initialized for LiteSpeed Web Server`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`📍 LiteSpeed will manage server lifecycle`);
    }
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;