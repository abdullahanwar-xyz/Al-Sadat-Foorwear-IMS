const express = require('express');
const router = express.Router();
const businessReportsController = require('../controllers/businessReportsController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../config/roles');

// All routes require authentication and SuperAdmin or ShopOwner role
router.use(authenticateToken);
router.use(authorizeRoles(ADMIN_ROLES));

/**
 * @route GET /api/business-reports/financial-summary
 * @desc KPI summary: revenue/receivables net of returns, expenses, refunds,
 *       supplier debts, bank balance
 * @query startDate, endDate (optional)
 */
router.get('/financial-summary', businessReportsController.getFinancialSummary);

/**
 * @route GET /api/business-reports/revenue-over-time
 * @desc Revenue net of returns, bucketed by day/week/month
 * @query startDate, endDate, groupBy ('day'|'week'|'month', optional)
 */
router.get('/revenue-over-time', businessReportsController.getRevenueOverTime);

/**
 * @route GET /api/business-reports/top-products
 * @desc Top-selling products and collections by net units/revenue
 * @query startDate, endDate, limit (optional)
 */
router.get('/top-products', businessReportsController.getTopProducts);

/**
 * @route GET /api/business-reports/returns-summary
 * @desc Returns & exchanges totals (goods value, cash refunded) and recent activity
 * @query startDate, endDate (optional)
 */
router.get('/returns-summary', businessReportsController.getReturnsSummary);

/**
 * @route GET /api/business-reports/stock
 * @desc Stock value and low/out-of-stock breakdown (point-in-time)
 */
router.get('/stock', businessReportsController.getStockReport);

/**
 * @route GET /api/business-reports/supplier-debts
 * @desc All suppliers with an outstanding balance owed
 */
router.get('/supplier-debts', businessReportsController.getSupplierDebts);

/**
 * @route GET /api/business-reports/customer-receivables
 * @desc Customers who still owe money, net of returns/exchanges
 */
router.get('/customer-receivables', businessReportsController.getCustomerReceivables);

/**
 * @route GET /api/business-reports/cash-flow-analysis
 * @desc Deposits/withdrawals across bank & cash accounts
 * @query startDate, endDate (optional)
 */
router.get('/cash-flow-analysis', businessReportsController.getCashFlowAnalysis);

/**
 * @route GET /api/business-reports/expense-breakdown
 * @desc Expense totals by category
 * @query startDate, endDate (optional)
 */
router.get('/expense-breakdown', businessReportsController.getExpenseBreakdown);

/**
 * @route GET /api/business-reports/daily-cash-summary
 * @desc Per-account Money In/Out/Ending Balance for a single day, built
 *       from the CashFlow ledger
 * @query date (YYYY-MM-DD, optional - defaults to today)
 */
router.get('/daily-cash-summary', businessReportsController.getDailyCashSummary);

module.exports = router;
