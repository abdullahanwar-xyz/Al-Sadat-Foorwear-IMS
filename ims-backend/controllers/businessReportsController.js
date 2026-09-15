const { sequelize } = require('../config/db');
const { Op, QueryTypes } = require('sequelize');
const Expense = require('../models/Expense');
const Supplier = require('../models/Supplier');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');

// Matches the stock-badge threshold already used in Record Sale/Inventory
// (0 = out of stock, <=10 = low stock).
const LOW_STOCK_THRESHOLD = 10;

// Today's date as a YYYY-MM-DD string in the server's local timezone
// (process.env.TZ = 'Asia/Karachi', set in app.js) - deliberately not
// toISOString(), which is always UTC and would silently shift the "today"
// boundary by up to 5 hours.
function todayLocalDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Sums a bucket of {account_id, transaction_type, total} rows into
// {in, out} per account - deposit/transfer_in count as in,
// withdrawal/transfer_out count as out.
function sumInOutByAccount(rows) {
  const map = new Map();
  for (const row of rows) {
    const entry = map.get(row.account_id) || { in: 0, out: 0 };
    const amount = parseFloat(row.total) || 0;
    if (row.transaction_type === 'deposit' || row.transaction_type === 'transfer_in') {
      entry.in += amount;
    } else if (row.transaction_type === 'withdrawal' || row.transaction_type === 'transfer_out') {
      entry.out += amount;
    }
    map.set(row.account_id, entry);
  }
  return map;
}

class BusinessReportsController {
  /**
   * Comprehensive financial summary for the KPI cards. Revenue and
   * receivables are computed net of returns/exchanges - each invoice line's
   * current value is (quantity - returnedQuantity) * rate, which already
   * reflects both plain returns and exchanged-in replacement items (added as
   * their own invoice_items rows), the same math the Invoices page uses.
   */
  async getFinancialSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const hasDateRange = !!(startDate && endDate);
      const invoiceDateClause = hasDateRange ? 'AND i.date BETWEEN :startDate AND :endDate' : '';
      const returnDateClause = hasDateRange ? 'AND r.date BETWEEN :startDate AND :endDate' : '';
      const replacements = hasDateRange ? { startDate, endDate } : {};

      const [revenueRow] = await sequelize.query(`
        SELECT COALESCE(SUM((ii.quantity - ii.returnedQuantity) * ii.rate), 0) AS total
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoiceId
        WHERE i.status != 'cancelled' ${invoiceDateClause}
      `, { replacements, type: QueryTypes.SELECT });
      const totalRevenue = parseFloat(revenueRow.total);

      // Amount customers still owe: current (returns-adjusted) invoice value
      // minus everything paid against it so far, floored at 0 per invoice.
      const [receivablesRow] = await sequelize.query(`
        SELECT COALESCE(SUM(GREATEST(0, current_value - paid)), 0) AS total
        FROM (
          SELECT i.id,
            COALESCE(SUM((ii.quantity - ii.returnedQuantity) * ii.rate), 0) AS current_value,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoiceId = i.id), 0) AS paid
          FROM invoices i
          LEFT JOIN invoice_items ii ON ii.invoiceId = i.id
          WHERE i.status != 'cancelled' ${invoiceDateClause}
          GROUP BY i.id
        ) t
      `, { replacements, type: QueryTypes.SELECT });
      const totalReceivables = parseFloat(receivablesRow.total);

      const expensesResult = await Expense.findOne({
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        where: hasDateRange ? { expense_date: { [Op.between]: [startDate, endDate] } } : {},
        raw: true
      });
      const totalExpenses = parseFloat(expensesResult?.total || 0);

      // Real cash refunded, filtered on the Return's business date so it
      // lines up with the same date axis as revenue/expenses.
      const [refundRow] = await sequelize.query(`
        SELECT COALESCE(SUM(rf.amount), 0) AS total
        FROM refunds rf
        JOIN returns r ON r.id = rf.returnId
        WHERE 1 = 1 ${returnDateClause}
      `, { replacements, type: QueryTypes.SELECT });
      const totalRefunded = parseFloat(refundRow.total);

      const debtsResult = await Supplier.findOne({
        attributes: [[sequelize.fn('SUM', sequelize.col('current_balance')), 'total']],
        where: { current_balance: { [Op.gt]: 0 } },
        raw: true
      });
      const totalOwedToSuppliers = parseFloat(debtsResult?.total || 0);

      const bankingResult = await BankAccount.findAll({
        attributes: ['account_id', 'account_name', 'account_type', 'current_balance', 'status'],
        where: { status: 1 },
        raw: true
      });
      const totalBankBalance = bankingResult.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0);

      const profitLoss = totalRevenue - totalExpenses;

      res.json({
        success: true,
        data: {
          totalRevenue,
          totalExpenses,
          totalRefunded,
          profitLoss,
          profitMargin: totalRevenue > 0 ? ((profitLoss / totalRevenue) * 100).toFixed(2) : '0.00',
          totalReceivables,
          totalOwedToSuppliers,
          totalBankBalance,
          bankAccounts: bankingResult,
          dateRange: hasDateRange ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getFinancialSummary:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch financial summary', error: error.message });
    }
  }

  /**
   * Revenue over time, net of returns, bucketed by day/week/month. Revenue
   * is attributed to the invoice's original sale date - each bucket shows
   * what those sales are worth right now, not a running ledger with
   * separate negative entries on the day something was returned.
   */
  async getRevenueOverTime(req, res) {
    try {
      const { startDate, endDate, groupBy } = req.query;
      const hasDateRange = !!(startDate && endDate);
      const dateClause = hasDateRange ? 'AND i.date BETWEEN :startDate AND :endDate' : '';
      const format = groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%x-W%v' : '%Y-%m-%d';

      const rows = await sequelize.query(`
        SELECT
          DATE_FORMAT(i.date, :format) AS period,
          MIN(i.date) AS periodStart,
          COUNT(DISTINCT i.id) AS orderCount,
          COALESCE(SUM((ii.quantity - ii.returnedQuantity) * ii.rate), 0) AS revenue
        FROM invoices i
        JOIN invoice_items ii ON ii.invoiceId = i.id
        WHERE i.status != 'cancelled' ${dateClause}
        GROUP BY period
        ORDER BY periodStart ASC
      `, {
        replacements: { format, ...(hasDateRange ? { startDate, endDate } : {}) },
        type: QueryTypes.SELECT
      });

      res.json({
        success: true,
        data: {
          points: rows.map(r => ({
            period: r.period,
            orderCount: parseInt(r.orderCount),
            revenue: parseFloat(r.revenue)
          })),
          groupBy: groupBy || 'day',
          dateRange: hasDateRange ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getRevenueOverTime:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch revenue over time', error: error.message });
    }
  }

  /**
   * Top-selling products and collections by net units/revenue (returns
   * already backed out via returnedQuantity).
   */
  async getTopProducts(req, res) {
    try {
      const { startDate, endDate, limit } = req.query;
      const hasDateRange = !!(startDate && endDate);
      const dateClause = hasDateRange ? 'AND i.date BETWEEN :startDate AND :endDate' : '';
      const replacements = hasDateRange ? { startDate, endDate } : {};
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

      const products = await sequelize.query(`
        SELECT
          p.id AS productId,
          p.name AS productName,
          p.collection AS collection,
          COALESCE(SUM(ii.quantity - ii.returnedQuantity), 0) AS unitsSold,
          COALESCE(SUM((ii.quantity - ii.returnedQuantity) * ii.rate), 0) AS revenue,
          COUNT(DISTINCT ii.invoiceId) AS orderCount
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoiceId
        JOIN products p ON p.id = ii.productId
        WHERE i.status != 'cancelled' ${dateClause}
        GROUP BY p.id, p.name, p.collection
        ORDER BY revenue DESC
        LIMIT ${limitNum}
      `, { replacements, type: QueryTypes.SELECT });

      const collections = await sequelize.query(`
        SELECT
          p.collection AS collection,
          COALESCE(SUM(ii.quantity - ii.returnedQuantity), 0) AS unitsSold,
          COALESCE(SUM((ii.quantity - ii.returnedQuantity) * ii.rate), 0) AS revenue
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoiceId
        JOIN products p ON p.id = ii.productId
        WHERE i.status != 'cancelled' ${dateClause}
        GROUP BY p.collection
        ORDER BY revenue DESC
      `, { replacements, type: QueryTypes.SELECT });

      res.json({
        success: true,
        data: {
          products: products.map(p => ({
            productId: p.productId,
            productName: p.productName,
            collection: p.collection,
            unitsSold: parseFloat(p.unitsSold),
            revenue: parseFloat(p.revenue),
            orderCount: parseInt(p.orderCount)
          })),
          collections: collections.map(c => ({
            collection: c.collection,
            unitsSold: parseFloat(c.unitsSold),
            revenue: parseFloat(c.revenue)
          })),
          dateRange: hasDateRange ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getTopProducts:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch top products', error: error.message });
    }
  }

  /**
   * Returns & exchanges summary: how much went back out the door, in goods
   * value and in real cash refunded, plus a recent-activity list.
   */
  async getReturnsSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const hasDateRange = !!(startDate && endDate);
      const dateClause = hasDateRange ? 'AND r.date BETWEEN :startDate AND :endDate' : '';
      const replacements = hasDateRange ? { startDate, endDate } : {};

      const [totals] = await sequelize.query(`
        SELECT
          COUNT(DISTINCT r.id) AS totalReturns,
          COUNT(DISTINCT CASE WHEN r.type = 'exchange' THEN r.id END) AS totalExchanges,
          COUNT(DISTINCT CASE WHEN r.type = 'return' THEN r.id END) AS totalPlainReturns,
          COALESCE(SUM(ri.refundAmount), 0) AS totalReturnedValue
        FROM returns r
        LEFT JOIN return_items ri ON ri.returnId = r.id
        WHERE 1 = 1 ${dateClause}
      `, { replacements, type: QueryTypes.SELECT });

      const [refundTotals] = await sequelize.query(`
        SELECT COALESCE(SUM(rf.amount), 0) AS totalRefunded
        FROM refunds rf
        JOIN returns r ON r.id = rf.returnId
        WHERE 1 = 1 ${dateClause}
      `, { replacements, type: QueryTypes.SELECT });

      const [topUpTotals] = await sequelize.query(`
        SELECT COALESCE(SUM(p.amount), 0) AS totalAdditionalCollected
        FROM payments p
        JOIN returns r ON r.id = p.returnId
        WHERE p.returnId IS NOT NULL ${dateClause}
      `, { replacements, type: QueryTypes.SELECT });

      const recentReturns = await sequelize.query(`
        SELECT
          r.id AS returnId,
          r.date AS date,
          r.type AS type,
          i.invoiceNumber AS invoiceNumber,
          COALESCE(SUM(ri.refundAmount), 0) AS refundAmount,
          COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.returnId = r.id), 0) AS additionalPaymentAmount
        FROM returns r
        JOIN invoices i ON i.id = r.invoiceId
        LEFT JOIN return_items ri ON ri.returnId = r.id
        WHERE 1 = 1 ${dateClause}
        GROUP BY r.id, r.date, r.type, i.invoiceNumber
        ORDER BY r.date DESC, r.id DESC
        LIMIT 50
      `, { replacements, type: QueryTypes.SELECT });

      res.json({
        success: true,
        data: {
          totalReturns: parseInt(totals.totalReturns),
          totalExchanges: parseInt(totals.totalExchanges),
          totalPlainReturns: parseInt(totals.totalPlainReturns),
          totalReturnedValue: parseFloat(totals.totalReturnedValue),
          totalRefunded: parseFloat(refundTotals.totalRefunded),
          totalAdditionalCollected: parseFloat(topUpTotals.totalAdditionalCollected),
          recentReturns: recentReturns.map(r => ({
            returnId: r.returnId,
            date: r.date,
            type: r.type,
            invoiceNumber: r.invoiceNumber,
            refundAmount: parseFloat(r.refundAmount),
            additionalPaymentAmount: parseFloat(r.additionalPaymentAmount)
          })),
          dateRange: hasDateRange ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getReturnsSummary:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch returns summary', error: error.message });
    }
  }

  /**
   * Stock value and low/out-of-stock breakdown, point-in-time (no date
   * filter - stock is a current snapshot, not a period).
   */
  async getStockReport(req, res) {
    try {
      const rows = await sequelize.query(`
        SELECT
          p.id AS productId,
          p.name AS productName,
          p.collection AS collection,
          pcr.color AS color,
          pcr.rate AS rate,
          ps.size AS size,
          ps.quantity AS quantity
        FROM product_sizes ps
        JOIN product_color_rates pcr ON pcr.id = ps.productColorRateId
        JOIN products p ON p.id = pcr.productId
      `, { type: QueryTypes.SELECT });

      let totalStockUnits = 0;
      let totalStockValue = 0;
      let outOfStockCount = 0;
      const lowStockItems = [];
      const byCollectionMap = new Map();

      for (const row of rows) {
        const quantity = parseInt(row.quantity, 10);
        const rate = parseFloat(row.rate);
        const value = quantity * rate;

        totalStockUnits += quantity;
        totalStockValue += value;
        if (quantity === 0) outOfStockCount++;
        if (quantity <= LOW_STOCK_THRESHOLD) {
          lowStockItems.push({
            productId: row.productId,
            productName: row.productName,
            collection: row.collection,
            color: row.color,
            size: row.size,
            quantity,
            rate,
            value
          });
        }

        const existing = byCollectionMap.get(row.collection) || { collection: row.collection, units: 0, value: 0 };
        existing.units += quantity;
        existing.value += value;
        byCollectionMap.set(row.collection, existing);
      }

      lowStockItems.sort((a, b) => a.quantity - b.quantity);

      res.json({
        success: true,
        data: {
          totalStockUnits,
          totalStockValue,
          outOfStockCount,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          lowStockItems,
          byCollection: Array.from(byCollectionMap.values()).sort((a, b) => b.value - a.value)
        }
      });
    } catch (error) {
      console.error('Error in getStockReport:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stock report', error: error.message });
    }
  }

  /**
   * Suppliers with an outstanding balance owed.
   */
  async getSupplierDebts(req, res) {
    try {
      const suppliers = await Supplier.findAll({
        attributes: ['supplier_id', 'name', 'phone', 'opening_balance', 'current_balance', 'status'],
        where: { current_balance: { [Op.gt]: 0 } },
        order: [['current_balance', 'DESC']]
      });

      const totalDebt = suppliers.reduce((sum, supplier) => sum + parseFloat(supplier.current_balance || 0), 0);

      res.json({
        success: true,
        data: {
          suppliers: suppliers.map(s => ({
            supplierId: s.supplier_id,
            name: s.name,
            phone: s.phone,
            openingBalance: parseFloat(s.opening_balance).toFixed(2),
            currentBalance: parseFloat(s.current_balance).toFixed(2),
            status: s.status
          })),
          totalDebt: totalDebt.toFixed(2)
        }
      });
    } catch (error) {
      console.error('Error in getSupplierDebts:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch supplier debts', error: error.message });
    }
  }

  /**
   * Customers who still owe money, computed net of returns/exchanges (same
   * current-value-minus-paid math as getFinancialSummary's receivables
   * total) rather than the frozen Invoice.remainingAmount field, which is
   * never adjusted when a return/exchange changes what an invoice is worth.
   */
  async getCustomerReceivables(req, res) {
    try {
      const rows = await sequelize.query(`
        SELECT
          c.id AS customerId,
          c.name AS name,
          c.phone AS phone,
          c.address AS address,
          i.id AS invoiceId,
          i.invoiceNumber AS invoiceNumber,
          i.date AS date,
          COALESCE(item_totals.currentValue, 0) AS currentValue,
          COALESCE(paid_totals.paid, 0) AS paid
        FROM invoices i
        JOIN customers c ON c.id = i.customerId
        LEFT JOIN (
          SELECT invoiceId, SUM((quantity - returnedQuantity) * rate) AS currentValue
          FROM invoice_items GROUP BY invoiceId
        ) item_totals ON item_totals.invoiceId = i.id
        LEFT JOIN (
          SELECT invoiceId, SUM(amount) AS paid
          FROM payments GROUP BY invoiceId
        ) paid_totals ON paid_totals.invoiceId = i.id
        WHERE i.status != 'cancelled'
      `, { type: QueryTypes.SELECT });

      const byCustomer = new Map();
      for (const row of rows) {
        const remaining = Math.max(0, parseFloat(row.currentValue) - parseFloat(row.paid));
        if (remaining <= 0.01) continue;

        if (!byCustomer.has(row.customerId)) {
          byCustomer.set(row.customerId, {
            customerId: row.customerId,
            name: row.name,
            phone: row.phone,
            address: row.address,
            totalReceivable: 0,
            invoices: []
          });
        }
        const entry = byCustomer.get(row.customerId);
        entry.totalReceivable += remaining;
        entry.invoices.push({
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
          date: row.date,
          netAmount: parseFloat(row.currentValue),
          remainingAmount: remaining
        });
      }

      const customers = Array.from(byCustomer.values())
        .map(c => ({ ...c, invoiceCount: c.invoices.length }))
        .sort((a, b) => b.totalReceivable - a.totalReceivable);

      const totalReceivables = customers.reduce((sum, c) => sum + c.totalReceivable, 0);

      res.json({
        success: true,
        data: { customers, totalReceivables, customerCount: customers.length }
      });
    } catch (error) {
      console.error('Error in getCustomerReceivables:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch customer receivables', error: error.message });
    }
  }

  /**
   * Cash flow analysis (deposits/withdrawals across bank & cash accounts).
   */
  async getCashFlowAnalysis(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.transaction_date = { [Op.between]: [startDate, endDate] };
      }

      const cashFlows = await CashFlow.findAll({
        attributes: [
          'flow_id', 'account_id', 'transaction_type', 'amount', 'balance_after',
          'description', 'transaction_date', 'reference_type', 'reference_id'
        ],
        include: [{ model: BankAccount, as: 'account', attributes: ['account_id', 'account_name', 'account_type'] }],
        where: dateFilter,
        order: [['transaction_date', 'DESC'], ['flow_id', 'DESC']],
        limit: 100
      });

      const deposits = cashFlows.filter(cf => cf.transaction_type === 'deposit').reduce((sum, cf) => sum + parseFloat(cf.amount), 0);
      const withdrawals = cashFlows.filter(cf => cf.transaction_type === 'withdrawal').reduce((sum, cf) => sum + parseFloat(cf.amount), 0);

      res.json({
        success: true,
        data: {
          cashFlows: cashFlows.map(cf => ({
            flowId: cf.flow_id,
            accountName: cf.account?.account_name || 'Unknown',
            accountType: cf.account?.account_type || 'N/A',
            transactionType: cf.transaction_type,
            amount: parseFloat(cf.amount).toFixed(2),
            balanceAfter: parseFloat(cf.balance_after).toFixed(2),
            description: cf.description,
            date: cf.transaction_date,
            referenceType: cf.reference_type,
            referenceId: cf.reference_id
          })),
          summary: {
            totalDeposits: deposits.toFixed(2),
            totalWithdrawals: withdrawals.toFixed(2),
            netCashFlow: (deposits - withdrawals).toFixed(2)
          },
          dateRange: startDate && endDate ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getCashFlowAnalysis:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch cash flow analysis', error: error.message });
    }
  }

  /**
   * Expense breakdown by category.
   */
  async getExpenseBreakdown(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.expense_date = { [Op.between]: [startDate, endDate] };
      }

      const expenses = await Expense.findAll({
        attributes: ['category', [sequelize.fn('COUNT', sequelize.col('expense_id')), 'count'], [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        where: dateFilter,
        group: ['category'],
        order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
        raw: true
      });

      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.total || 0), 0);

      const breakdown = expenses.map(exp => ({
        category: exp.category,
        count: parseInt(exp.count),
        total: parseFloat(exp.total).toFixed(2),
        percentage: totalExpenses > 0 ? ((parseFloat(exp.total) / totalExpenses) * 100).toFixed(2) : '0.00'
      }));

      res.json({
        success: true,
        data: {
          breakdown,
          totalExpenses: totalExpenses.toFixed(2),
          dateRange: startDate && endDate ? { startDate, endDate } : null
        }
      });
    } catch (error) {
      console.error('Error in getExpenseBreakdown:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch expense breakdown', error: error.message });
    }
  }

  /**
   * Daily Cash Summary: for every active account, what moved on the
   * selected day (default today) and what its balance was at the end of
   * that day - built entirely from the CashFlow ledger, the single source
   * of truth for every real money movement, grouped by account and date.
   *
   * Ending balance is NOT just account.current_balance (that's only
   * correct for today) - it's current_balance minus the net of every
   * CashFlow row that happened AFTER the selected day, so picking a past
   * date still gives that day's true historical ending balance. Opening
   * balance is then ending balance minus that day's own net movement.
   *
   * Deliberately does not try to bucket "Money In" by sales channel
   * (Store/Online/etc.) - recordPayment tags its CashFlow rows
   * reference_type: 'other', not 'invoice', so that split isn't reliably
   * derivable from the ledger. Instead each account's day is shown as an
   * honest itemized list of the real CashFlow rows.
   */
  async getDailyCashSummary(req, res) {
    try {
      const dateStr = req.query.date || todayLocalDateString();
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);

      const accounts = await BankAccount.findAll({
        where: { status: 1 },
        attributes: ['account_id', 'account_name', 'account_type', 'current_balance'],
        order: [['account_type', 'ASC'], ['account_name', 'ASC']],
        raw: true
      });

      const afterRows = await CashFlow.findAll({
        attributes: ['account_id', 'transaction_type', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        where: { transaction_date: { [Op.gt]: endOfDay } },
        group: ['account_id', 'transaction_type'],
        raw: true
      });
      const afterMap = sumInOutByAccount(afterRows);

      const todayRows = await CashFlow.findAll({
        attributes: ['account_id', 'transaction_type', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        where: { transaction_date: { [Op.between]: [startOfDay, endOfDay] } },
        group: ['account_id', 'transaction_type'],
        raw: true
      });
      const todayMap = sumInOutByAccount(todayRows);

      const detailRows = await CashFlow.findAll({
        attributes: ['flow_id', 'account_id', 'transaction_type', 'amount', 'description', 'transaction_date', 'reference_type', 'reference_id'],
        where: { transaction_date: { [Op.between]: [startOfDay, endOfDay] } },
        order: [['transaction_date', 'ASC'], ['flow_id', 'ASC']],
        raw: true
      });
      const detailByAccount = new Map();
      for (const row of detailRows) {
        const list = detailByAccount.get(row.account_id) || [];
        list.push({
          flowId: row.flow_id,
          transactionType: row.transaction_type,
          amount: parseFloat(row.amount),
          description: row.description,
          time: row.transaction_date,
          referenceType: row.reference_type,
          referenceId: row.reference_id
        });
        detailByAccount.set(row.account_id, list);
      }

      const accountSummaries = accounts.map(account => {
        const after = afterMap.get(account.account_id) || { in: 0, out: 0 };
        const afterNet = after.in - after.out;
        const endingBalance = parseFloat(account.current_balance) - afterNet;

        const today = todayMap.get(account.account_id) || { in: 0, out: 0 };
        const netToday = today.in - today.out;
        const openingBalance = endingBalance - netToday;

        return {
          accountId: account.account_id,
          accountName: account.account_name,
          accountType: account.account_type,
          openingBalance,
          moneyIn: today.in,
          moneyOut: today.out,
          netToday,
          endingBalance,
          transactions: detailByAccount.get(account.account_id) || []
        };
      });

      const grandTotal = accountSummaries.reduce((totals, acc) => ({
        openingBalance: totals.openingBalance + acc.openingBalance,
        moneyIn: totals.moneyIn + acc.moneyIn,
        moneyOut: totals.moneyOut + acc.moneyOut,
        netToday: totals.netToday + acc.netToday,
        endingBalance: totals.endingBalance + acc.endingBalance
      }), { openingBalance: 0, moneyIn: 0, moneyOut: 0, netToday: 0, endingBalance: 0 });

      res.json({
        success: true,
        data: {
          date: dateStr,
          accounts: accountSummaries,
          grandTotal
        }
      });
    } catch (error) {
      console.error('Error in getDailyCashSummary:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch daily cash summary', error: error.message });
    }
  }
}

module.exports = new BusinessReportsController();
