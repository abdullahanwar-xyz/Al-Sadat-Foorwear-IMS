import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BackendLayout } from "@/components/layout/backend-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Wallet,
  Calendar,
  Package,
  Download,
  Printer,
  Undo2,
  PackageSearch,
} from "lucide-react";
import { businessReportsAPI } from "@/service/api";
import { formatPKR } from "@/utils/currency";

export default function BackendReports() {
  const [dateRange, setDateRange] = useState<string>("30");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [revenueGroupBy, setRevenueGroupBy] = useState<"day" | "week" | "month">("day");

  const getDateFilter = () => {
    const today = new Date();
    let startDate = "";
    let endDate = today.toISOString().split("T")[0];

    if (dateRange === "custom") {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    if (dateRange === "today") {
      startDate = endDate;
    } else if (dateRange === "7") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      startDate = sevenDaysAgo.toISOString().split("T")[0];
    } else if (dateRange === "30") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString().split("T")[0];
    } else if (dateRange === "thisMonth") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    } else if (dateRange === "lastMonth") {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      startDate = lastMonth.toISOString().split("T")[0];
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      endDate = lastDayOfLastMonth.toISOString().split("T")[0];
    }

    return { startDate, endDate };
  };

  const filters = dateRange !== "all" ? getDateFilter() : {};

  const { data: financialData, isLoading: loadingFinancial } = useQuery({
    queryKey: ["financial-summary", filters],
    queryFn: () => businessReportsAPI.getFinancialSummary(filters),
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ["revenue-over-time", filters, revenueGroupBy],
    queryFn: () => businessReportsAPI.getRevenueOverTime({ ...filters, groupBy: revenueGroupBy }),
  });

  const { data: topProductsData, isLoading: loadingTopProducts } = useQuery({
    queryKey: ["top-products", filters],
    queryFn: () => businessReportsAPI.getTopProducts({ ...filters, limit: 10 }),
  });

  const { data: returnsData, isLoading: loadingReturns } = useQuery({
    queryKey: ["returns-summary", filters],
    queryFn: () => businessReportsAPI.getReturnsSummary(filters),
  });

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ["stock-report"],
    queryFn: () => businessReportsAPI.getStockReport(),
  });

  const { data: debtsData, isLoading: loadingDebts } = useQuery({
    queryKey: ["supplier-debts"],
    queryFn: () => businessReportsAPI.getSupplierDebts(),
  });

  const { data: receivablesData, isLoading: loadingReceivables } = useQuery({
    queryKey: ["customer-receivables"],
    queryFn: () => businessReportsAPI.getCustomerReceivables(),
  });

  const { data: cashFlowData, isLoading: loadingCashFlow } = useQuery({
    queryKey: ["cash-flow-analysis", filters],
    queryFn: () => businessReportsAPI.getCashFlowAnalysis(filters),
  });

  const { data: expenseData, isLoading: loadingExpense } = useQuery({
    queryKey: ["expense-breakdown", filters],
    queryFn: () => businessReportsAPI.getExpenseBreakdown(filters),
  });

  const summary = financialData?.data;
  const isLoading =
    loadingFinancial || loadingRevenue || loadingTopProducts || loadingReturns ||
    loadingStock || loadingDebts || loadingReceivables || loadingCashFlow || loadingExpense;

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = {
      financialSummary: summary,
      revenueOverTime: revenueData?.data,
      topProducts: topProductsData?.data,
      returnsSummary: returnsData?.data,
      stockReport: stockData?.data,
      supplierDebts: debtsData?.data,
      customerReceivables: receivablesData?.data,
      cashFlowAnalysis: cashFlowData?.data,
      expenseBreakdown: expenseData?.data,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-reports-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxRevenuePoint = Math.max(1, ...(revenueData?.data.points.map((p) => p.revenue) || [0]));
  const maxTopProductRevenue = Math.max(1, ...(topProductsData?.data.products.map((p) => p.revenue) || [0]));

  return (
    <BackendLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Business Reports &amp; Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Revenue, top sellers, returns, stock, and cash position - net of returns and exchanges
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Range Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Select Period</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === "custom" && (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-slate-600">Loading reports...</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPKR(summary?.totalRevenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Net of returns/exchanges</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatPKR(summary?.totalExpenses || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Business costs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                  {(summary?.profitLoss || 0) >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(summary?.profitLoss || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPKR(summary?.profitLoss || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Margin: {summary?.profitMargin || 0}%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
                  <Undo2 className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatPKR(summary?.totalRefunded || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {returnsData?.data.totalReturns || 0} return(s)/exchange(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Bank Balance</CardTitle>
                  <Wallet className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPKR(summary?.totalBankBalance || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">All accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receivables</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatPKR(summary?.totalReceivables || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From {receivablesData?.data.customerCount || 0} customers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Supplier Debts</CardTitle>
                  <Building2 className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatPKR(summary?.totalOwedToSuppliers || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Owed to suppliers</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
                  <Package className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatPKR(stockData?.data.totalStockValue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stockData?.data.outOfStockCount || 0} out of stock
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="revenue" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto">
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="products">Top Sellers</TabsTrigger>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="stock">Stock</TabsTrigger>
                <TabsTrigger value="receivables">Receivables</TabsTrigger>
                <TabsTrigger value="debts">Supplier Debts</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              </TabsList>

              {/* Revenue Over Time */}
              <TabsContent value="revenue" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Revenue Over Time</CardTitle>
                      <CardDescription>Net of returns and exchanges, by sale date</CardDescription>
                    </div>
                    <Select value={revenueGroupBy} onValueChange={(v: "day" | "week" | "month") => setRevenueGroupBy(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {revenueData?.data.points.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">No sales in this period</div>
                    ) : (
                      <div className="space-y-2">
                        {revenueData?.data.points.map((point) => (
                          <div key={point.period} className="flex items-center gap-3">
                            <span className="w-24 text-sm text-muted-foreground shrink-0">{point.period}</span>
                            <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                              <div
                                className="h-full bg-green-500/70 rounded"
                                style={{ width: `${(point.revenue / maxRevenuePoint) * 100}%` }}
                              />
                            </div>
                            <span className="w-32 text-sm font-medium text-right shrink-0">{formatPKR(point.revenue)}</span>
                            <span className="w-20 text-xs text-muted-foreground text-right shrink-0">
                              {point.orderCount} order(s)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top-Selling Products & Collections */}
              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top-Selling Products</CardTitle>
                    <CardDescription>By net revenue (units and revenue already exclude returned quantity)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topProductsData?.data.products.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No sales in this period</div>
                    ) : (
                      <div className="space-y-2">
                        {topProductsData?.data.products.map((product, index) => (
                          <div key={product.productId} className="flex items-center gap-3">
                            <span className="w-6 text-sm font-semibold text-muted-foreground shrink-0">#{index + 1}</span>
                            <div className="w-40 shrink-0">
                              <p className="font-medium text-sm truncate">{product.productName}</p>
                              <p className="text-xs text-muted-foreground">{product.collection}</p>
                            </div>
                            <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                              <div
                                className="h-full bg-indigo-500/70 rounded"
                                style={{ width: `${(product.revenue / maxTopProductRevenue) * 100}%` }}
                              />
                            </div>
                            <span className="w-28 text-sm font-medium text-right shrink-0">{formatPKR(product.revenue)}</span>
                            <span className="w-24 text-xs text-muted-foreground text-right shrink-0">
                              {product.unitsSold} pair(s)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Collection</CardTitle>
                    <CardDescription>Net revenue grouped by collection</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Collection</TableHead>
                            <TableHead className="text-right">Units Sold</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topProductsData?.data.collections.map((c) => (
                            <TableRow key={c.collection}>
                              <TableCell className="font-medium">{c.collection}</TableCell>
                              <TableCell className="text-right">{c.unitsSold}</TableCell>
                              <TableCell className="text-right font-semibold">{formatPKR(c.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Returns & Exchanges */}
              <TabsContent value="returns" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Returns / Exchanges</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{returnsData?.data.totalReturns || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {returnsData?.data.totalPlainReturns || 0} return(s), {returnsData?.data.totalExchanges || 0} exchange(s)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Goods Value Returned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatPKR(returnsData?.data.totalReturnedValue || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Cash Refunded</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatPKR(returnsData?.data.totalRefunded || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        +{formatPKR(returnsData?.data.totalAdditionalCollected || 0)} collected on exchange top-ups
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Return Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {returnsData?.data.recentReturns.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No returns in this period</div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Refund Amount</TableHead>
                              <TableHead className="text-right">Additional Payment</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnsData?.data.recentReturns.map((r) => (
                              <TableRow key={r.returnId}>
                                <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
                                <TableCell>
                                  <Badge variant={r.type === "exchange" ? "secondary" : "destructive"}>{r.type}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-amber-600">
                                  {r.refundAmount > 0 ? formatPKR(r.refundAmount) : "—"}
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                  {r.additionalPaymentAmount > 0 ? formatPKR(r.additionalPaymentAmount) : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Stock Value & Low Stock */}
              <TabsContent value="stock" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stockData?.data.totalStockUnits || 0} pairs</div>
                      <p className="text-xs text-muted-foreground mt-1">{formatPKR(stockData?.data.totalStockValue || 0)} value</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{stockData?.data.outOfStockCount || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">size/color combinations</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Low Stock (≤ {stockData?.data.lowStockThreshold ?? 10})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">{stockData?.data.lowStockItems.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">needs restocking soon</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PackageSearch className="h-5 w-5" />
                      Low & Out-of-Stock Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stockData?.data.lowStockItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">Everything is well stocked</div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Collection</TableHead>
                              <TableHead>Color</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="text-right">Quantity</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stockData?.data.lowStockItems.map((item, index) => (
                              <TableRow key={`${item.productId}-${item.color}-${item.size}-${index}`}>
                                <TableCell className="font-medium">{item.productName}</TableCell>
                                <TableCell>{item.collection}</TableCell>
                                <TableCell>{item.color}</TableCell>
                                <TableCell>{item.size}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={item.quantity === 0 ? "destructive" : "secondary"}>{item.quantity}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{formatPKR(item.value)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stock Value by Collection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Collection</TableHead>
                            <TableHead className="text-right">Units</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockData?.data.byCollection.map((c) => (
                            <TableRow key={c.collection}>
                              <TableCell className="font-medium">{c.collection}</TableCell>
                              <TableCell className="text-right">{c.units}</TableCell>
                              <TableCell className="text-right font-semibold">{formatPKR(c.value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="receivables" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Receivables</CardTitle>
                    <CardDescription>Outstanding amounts from customers, net of returns/exchanges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {receivablesData?.data.customers.map((customer) => (
                        <Card key={customer.customerId}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{customer.name}</CardTitle>
                                <CardDescription>{customer.address || 'No address'} | {customer.phone}</CardDescription>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Receivable</p>
                                <p className="text-2xl font-bold text-orange-600">
                                  {formatPKR(customer.totalReceivable)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {customer.invoiceCount} invoice(s)
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Net Amount</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {customer.invoices.map((invoice) => (
                                    <TableRow key={invoice.invoiceId}>
                                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                      <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                      <TableCell className="text-right">
                                        {formatPKR(invoice.netAmount)}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-orange-600">
                                        {formatPKR(invoice.remainingAmount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {receivablesData?.data && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Customers with Pending Payments</p>
                            <p className="text-lg font-semibold">{receivablesData.data.customerCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Amount Receivable</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {formatPKR(receivablesData.data.totalReceivables)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="debts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Supplier Debts</CardTitle>
                    <CardDescription>Outstanding payments owed to suppliers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Supplier Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="text-right">Opening Balance</TableHead>
                            <TableHead className="text-right">Current Balance</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtsData?.data?.suppliers?.map((supplier) => (
                            <TableRow key={supplier.supplierId}>
                              <TableCell className="font-medium">{supplier.name}</TableCell>
                              <TableCell>{supplier.phone}</TableCell>
                              <TableCell className="text-right">
                                {formatPKR(parseFloat(supplier.openingBalance))}
                              </TableCell>
                              <TableCell className="text-right font-bold text-purple-600">
                                {formatPKR(parseFloat(supplier.currentBalance))}
                              </TableCell>
                              <TableCell>
                                <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                                  {supplier.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {debtsData?.data && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-right">
                        <p className="text-sm text-muted-foreground">Total Debt to Suppliers</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatPKR(parseFloat(debtsData.data.totalDebt))}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Expense Breakdown by Category</CardTitle>
                    <CardDescription>Analysis of business expenses across different categories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-right">Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenseData?.data?.breakdown?.map((category, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{category.category}</TableCell>
                              <TableCell className="text-right">{category.count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatPKR(parseFloat(category.total))}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{category.percentage}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {expenseData?.data && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-right">
                        <p className="text-sm text-muted-foreground">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatPKR(parseFloat(expenseData.data.totalExpenses))}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cashflow" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cash Flow Analysis</CardTitle>
                    <CardDescription>Recent deposits and withdrawals across all bank accounts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cashFlowData?.data?.summary && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold text-green-600">
                              {formatPKR(parseFloat(cashFlowData.data.summary.totalDeposits))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold text-red-600">
                              {formatPKR(parseFloat(cashFlowData.data.summary.totalWithdrawals))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className={`text-2xl font-bold ${parseFloat(cashFlowData.data.summary.netCashFlow) >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatPKR(parseFloat(cashFlowData.data.summary.netCashFlow))}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Balance After</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashFlowData?.data?.cashFlows?.map((flow) => (
                            <TableRow key={flow.flowId}>
                              <TableCell>{new Date(flow.date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{flow.accountName}</p>
                                  <p className="text-xs text-muted-foreground">{flow.accountType}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={flow.transactionType === 'deposit' ? 'default' : 'secondary'}>
                                  {flow.transactionType}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${flow.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                {flow.transactionType === 'deposit' ? '+' : '-'}
                                {formatPKR(parseFloat(flow.amount))}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPKR(parseFloat(flow.balanceAfter))}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{flow.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </BackendLayout>
  );
}
