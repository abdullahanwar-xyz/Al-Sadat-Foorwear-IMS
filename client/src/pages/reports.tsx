import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
// Remove LineChart as it's not used
import { BarChart3, PieChart, CalendarDays, TrendingUp, DollarSign, FileDown, Printer } from "lucide-react";
import { format, subDays, isWithinInterval, parse } from "date-fns";
import { customerAPI, productAPI, invoiceAPI, paymentAPI } from "../service/api";
import { useToast } from "../hooks/use-toast";
import { useReactToPrint } from 'react-to-print';
import { computeInvoiceBreakdown } from "../utils/returns";

type ReportPeriod = "today" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";
type ReportType = "sales" | "products" | "customers" | "payments";

export default function Reports() {
  // State
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("30days");
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch data for reports. The global QueryClient sets staleTime: Infinity
  // and refetchOnWindowFocus: false, so without an override this data is
  // cached indefinitely once fetched - a Sales Report tab left open (or
  // revisited later in the same session) would keep showing invoices that
  // were since deleted/changed elsewhere, exactly like the Invoices page
  // guards against with the same override (see invoices.tsx).
  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: () => invoiceAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => customerAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  const { data: payments } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: () => paymentAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  // Print functionality
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}`,
    onAfterPrint: () => {
      toast({
        title: "Report printed",
        description: "The report has been sent to the printer.",
      });
    },
    pageStyle: `
      @page {
        size: auto;
        margin: 5mm;
      }
      @media print {
        body {
          padding: 5mm;
        }
        .print-container {
          padding: 5mm;
          margin: 0;
        }
      }
    `,
  });

  // Utility functions
  const getDateRange = () => {
    const today = new Date();
    
    switch (reportPeriod) {
      case "today":
        return {
          start: new Date(today.setHours(0, 0, 0, 0)),
          end: new Date(today.setHours(23, 59, 59, 999)),
        };
      case "7days":
        return {
          start: subDays(today, 7),
          end: today,
        };
      case "30days":
        return {
          start: subDays(today, 30),
          end: today,
        };
      case "thisMonth":
        return {
          start: new Date(today.getFullYear(), today.getMonth(), 1),
          end: today,
        };
      case "lastMonth":
        return {
          start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
          end: new Date(today.getFullYear(), today.getMonth(), 0),
        };
      case "custom":
        return {
          start: parse(customDateRange.startDate, "yyyy-MM-dd", new Date()),
          end: parse(customDateRange.endDate, "yyyy-MM-dd", new Date()),
        };
      default:
        return {
          start: subDays(today, 30),
          end: today,
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Invoice.netAmount/remainingAmount are frozen at sale time and never
  // adjusted when a return/exchange changes what an invoice is actually
  // worth (same stale-field issue already fixed on Dashboard) - compute the
  // real current value instead. A cancelled sale has 0 value regardless of
  // its item/return history, since the whole sale was voided.
  const getCurrentInvoiceValue = (invoice: NonNullable<typeof invoices>[number]) => {
    if (invoice.status === "cancelled") return 0;
    return computeInvoiceBreakdown(invoice.items, invoice.returns, invoice.payments, invoice.netAmount).netAmount;
  };

  const getInvoicePaidAmount = (invoice: NonNullable<typeof invoices>[number]) =>
    (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Data processing for reports
  const processReportData = () => {
    if (!invoices || !customers || !products || !payments) return null;

    const { start, end } = getDateRange();

    // Filter data by date range
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      return isWithinInterval(invoiceDate, { start, end });
    });

    const filteredPayments = payments.filter(payment => {
      // Fix potential issue with payment dates
      const paymentDate = new Date(payment.paymentDate || payment.createdAt);
      return isWithinInterval(paymentDate, { start, end });
    });

    // Process data based on report type
    switch (reportType) {
      case "sales": {
        // Total sales, net of returns/exchanges and excluding cancelled sales
        const totalSales = filteredInvoices.reduce((sum, invoice) =>
          sum + getCurrentInvoiceValue(invoice), 0);

        const totalPaid = filteredPayments.reduce((sum, payment) =>
          sum + (Number(payment.amount) || 0), 0);

        // Sales by status with proper null checks
        const salesByStatus = {
          paid: filteredInvoices.filter(inv => inv.status === "paid")
            .reduce((sum, inv) => sum + getCurrentInvoiceValue(inv), 0),
          partial: filteredInvoices.filter(inv => inv.status === "partial")
            .reduce((sum, inv) => sum + getCurrentInvoiceValue(inv), 0),
          pending: filteredInvoices.filter(inv => inv.status === "pending" || inv.status === "unpaid")
            .reduce((sum, inv) => sum + getCurrentInvoiceValue(inv), 0),
        };

        // Sales by customer
        const salesByCustomer = customers.map(customer => {
          const customerInvoices = filteredInvoices.filter(inv => inv.customerId === customer.id);
          return {
            customerId: customer.id,
            customerName: customer.name,
            totalSales: customerInvoices.reduce((sum, inv) => sum + getCurrentInvoiceValue(inv), 0),
            invoiceCount: customerInvoices.length,
          };
        }).filter(item => item.totalSales > 0).sort((a, b) => b.totalSales - a.totalSales);

        return {
          totalSales,
          totalPaid,
          outstandingAmount: Math.max(0, totalSales - totalPaid), // Prevent negative values
          salesByStatus,
          salesByCustomer,
          invoices: filteredInvoices,
        };
      }
      
      case "products": {
        // Product sales analysis
        const productSales: Record<string, any> = {};
        
        // Go through each invoice and extract item details
        filteredInvoices.forEach(invoice => {
          if (Array.isArray(invoice.items)) {
            invoice.items.forEach(item => {
              const productId = item.productId;
              // Skip if productId is missing
              if (!productId) return;
              
              const product = products.find(p => p.id === productId);
              const productName = product?.name || `Product #${productId}`;
              const quantity = Number(item.quantity) || 0;
              const rate = Number(item.rate) || 0;
              const discount = Number(item.discount) || 0;
              const totalSale = (rate * quantity) - discount;
              const size = Number(item.size) || 0;
              
              if (!productSales[productId]) {
                productSales[productId] = {
                  productId,
                  productName,
                  totalSales: 0,
                  totalQuantity: 0,
                  totalFeet: 0,
                  transactions: 0,
                };
              }
              
              productSales[productId].totalSales += totalSale;
              productSales[productId].totalQuantity += quantity;
              productSales[productId].totalFeet += size * quantity;
              productSales[productId].transactions++;
            });
          }
        });
        
        return {
          products: Object.values(productSales).sort((a: any, b: any) => b.totalSales - a.totalSales),
          totalProductSales: Object.values(productSales).reduce((sum: number, product: any) => sum + product.totalSales, 0),
        };
      }
      
      case "customers": {
        // Customer analysis
        return {
          activeCustomers: customers.filter(c => 
            filteredInvoices.some(inv => inv.customerId === c.id)
          ).length,
          totalCustomers: customers.length,
          customerDetails: customers.map(customer => {
            const customerInvoices = filteredInvoices.filter(inv => inv.customerId === customer.id);
            const totalSpent = customerInvoices.reduce((sum, inv) => sum + getCurrentInvoiceValue(inv), 0);
            const unpaidAmount = customerInvoices
              .reduce((sum, inv) => sum + Math.max(0, getCurrentInvoiceValue(inv) - getInvoicePaidAmount(inv)), 0);
            
            return {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              invoiceCount: customerInvoices.length,
              totalSpent,
              unpaidAmount,
            };
          }).filter(c => c.invoiceCount > 0).sort((a, b) => b.totalSpent - a.totalSpent),
        };
      }
      
      case "payments": {
        // Payments analysis
        const paymentsByMethod: Record<string, number> = {};
        filteredPayments.forEach(payment => {
          const method = payment.method || "unknown";
          paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
        });
        
        return {
          totalCollected: filteredPayments.reduce((sum, payment) => sum + payment.amount, 0),
          paymentCount: filteredPayments.length,
          paymentsByMethod,
          recentPayments: filteredPayments.sort((a, b) => 
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
          ).slice(0, 10),
        };
      }
      
      default:
        return null;
    }
  };
  
  const reportData = processReportData();
  
  // Helper function for date range display
  const getDateRangeDisplay = () => {
    const { start, end } = getDateRange();
    return `${format(start, "MMM dd, yyyy")} - ${format(end, "MMM dd, yyyy")}`;
  };

  // Prevent chart rendering errors with empty data sets
  const hasData = reportData && 
    (reportType === "sales" ? (reportData.invoices && reportData.invoices.length > 0) : 
     reportType === "products" ? (reportData.products && reportData.products.length > 0) :
     reportType === "customers" ? (reportData.customerDetails && reportData.customerDetails.length > 0) :
     reportType === "payments" ? (reportData.paymentCount && reportData.paymentCount > 0) : false);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-poppins font-bold text-gray-800 mb-2">
          Sales Reports & Analytics
        </h1>
        <p className="text-gray-600">
          View sales performance, invoices, and payment reports
        </p>
      </div>

      {/* Report Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/4">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger id="reportType">
                  <SelectValue placeholder="Select Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">
                    <DollarSign className="h-4 w-4 mr-1 inline" /> Sales
                  </SelectItem>
                  <SelectItem value="products">
                    <BarChart3 className="h-4 w-4 mr-1 inline" /> Products
                  </SelectItem>
                  <SelectItem value="customers">
                    <PieChart className="h-4 w-4 mr-1 inline" /> Customers
                  </SelectItem>
                  <SelectItem value="payments">
                    <TrendingUp className="h-4 w-4 mr-1 inline" /> Payments
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full md:w-1/4">
              <Label htmlFor="reportPeriod">Time Period</Label>
              <Select value={reportPeriod} onValueChange={(value) => setReportPeriod(value as ReportPeriod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {reportPeriod === "custom" && (
              <>
                <div className="w-full md:w-1/5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                  />
                </div>
                <div className="w-full md:w-1/5">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                  />
                </div>
              </>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handlePrint}
                className="flex items-center"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button 
                variant="outline"
                className="flex items-center"
                onClick={() => {
                  const fileName = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.json`;
                  const dataStr = JSON.stringify(reportData);
                  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
                  
                  const link = document.createElement('a');
                  link.href = dataUri;
                  link.download = fileName;
                  link.click();
                }}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <div ref={printRef} className="print-content print-container">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-poppins">
              {reportType === "sales" && "Sales Report"}
              {reportType === "products" && "Product Analysis"}
              {reportType === "customers" && "Customer Insights"}
              {reportType === "payments" && "Payment Collection Report"}
            </CardTitle>
            <div className="flex items-center text-sm text-gray-500">
              <CalendarDays className="h-4 w-4 mr-1" /> {getDateRangeDisplay()}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {!hasData && (
              <div className="text-center p-12 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No data available for the selected period</p>
                <p>Try selecting a different time period or report type</p>
              </div>
            )}
            
            {hasData && reportType === "sales" && reportData && (
              <>
                {/* Handle potential division by zero in percentage calculations */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-blue-50">
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Total Sales</div>
                      <div className="text-3xl font-bold text-blue-700">{formatCurrency(reportData.totalSales ?? 0)}</div>
                      <div className="text-sm text-gray-600 mt-4">Invoice Count: {reportData.invoices?.length ?? 0}</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50">
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Amount Collected</div>
                      <div className="text-3xl font-bold text-green-700">{formatCurrency(reportData.totalPaid ?? 0)}</div>
                      <div className="text-sm text-gray-600 mt-4">
                        Collection Rate: {(reportData.totalSales ?? 0) > 0 
                          ? (((reportData.totalPaid ?? 0) / (reportData.totalSales ?? 1)) * 100).toFixed(1) 
                          : "0"}%
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-amber-50">
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Outstanding Amount</div>
                      <div className="text-3xl font-bold text-amber-700">{formatCurrency(reportData.outstandingAmount ?? 0)}</div>
                      <div className="text-sm text-gray-600 mt-4">
                        Pending: {(reportData.totalSales ?? 0) > 0
                          ? (((reportData.outstandingAmount ?? 0) / (reportData.totalSales ?? 1)) * 100).toFixed(1)
                          : "0.0"}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Sales by Status */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Sales by Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <Badge variant="default">Paid</Badge>
                          <div className="text-2xl font-bold mt-2">{formatCurrency(reportData.salesByStatus?.paid ?? 0)}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {((reportData.salesByStatus?.paid ?? 0) && reportData.totalSales
                            ? ((reportData.salesByStatus?.paid ?? 0) / reportData.totalSales) * 100
                            : 0
                          ).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <Badge variant="secondary">Partial</Badge>
                          <div className="text-2xl font-bold mt-2">{formatCurrency(reportData.salesByStatus?.partial ?? 0)}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {((reportData.salesByStatus?.partial ?? 0) && reportData.totalSales
                            ? ((reportData.salesByStatus?.partial ?? 0) / reportData.totalSales) * 100
                            : 0
                          ).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <Badge variant="destructive">Pending</Badge>
                          <div className="text-2xl font-bold mt-2">{formatCurrency(reportData.salesByStatus?.pending ?? 0)}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {((reportData.salesByStatus?.pending ?? 0) && reportData.totalSales
                            ? ((reportData.salesByStatus?.pending ?? 0) / reportData.totalSales) * 100
                            : 0
                          ).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                {/* Top Customers */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Top Customers by Sales</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice Count</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.salesByCustomer?.slice(0, 5).map((customer) => (
                        <TableRow key={customer.customerId}>
                          <TableCell className="font-medium">{customer.customerName}</TableCell>
                          <TableCell>{customer.invoiceCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.totalSales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Recent Invoices */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Recent Invoices</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.invoices?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 10)
                        .map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{invoice.customer?.name || 'Unknown'}</TableCell>
                            <TableCell>{format(new Date(invoice.date), "MMM dd, yyyy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(getCurrentInvoiceValue(invoice))}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invoice.status === "paid"
                                    ? "default"
                                    : invoice.status === "partial"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {invoice.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            
            {/* Product Report Content */}
            {reportType === "products" && reportData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Total Product Sales</div>
                      <div className="text-3xl font-bold text-blue-700">{formatCurrency(reportData.totalProductSales)}</div>
                      <div className="text-sm text-gray-600 mt-4">Products Sold: {reportData.products?.length ?? 0}</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Product Performance</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity Sold</TableHead>
                        <TableHead className="text-right">Total Feet</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                        <TableHead className="text-right">% of Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.products?.map((product: any) => (
                        <TableRow key={product.productId}>
                          <TableCell className="font-medium">{product.productName}</TableCell>
                          <TableCell className="text-right">{product.totalQuantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{product.totalFeet.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.totalSales)}</TableCell>
                          <TableCell className="text-right">
                            {((product.totalSales / reportData.totalProductSales) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            
            {/* Customer Report Content */}
            {reportType === "customers" && reportData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Active Customers</div>
                      <div className="text-3xl font-bold text-blue-700">{reportData.activeCustomers}</div>
                      <div className="text-sm text-gray-600 mt-4">
                        Out of {reportData.totalCustomers ?? 0} total customers ({(((reportData.activeCustomers ?? 0) / (reportData.totalCustomers ?? 1)) * 100).toFixed(1)}%)
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Customer Analysis</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.customerDetails?.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.phone || 'N/A'}</TableCell>
                          <TableCell className="text-right">{customer.invoiceCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.totalSpent)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.unpaidAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            
            {/* Payment Report Content */}
            {reportType === "payments" && reportData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-500 mb-1">Total Collected</div>
                      <div className="text-3xl font-bold text-green-700">{formatCurrency(reportData.totalCollected ?? 0)}</div>
                      <div className="text-sm text-gray-600 mt-4">Payments: {reportData.paymentCount}</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Payments by Method</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(reportData.paymentsByMethod ?? {}).map(([method, amount]) => (
                      <Card key={method}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="capitalize">{method}</Badge>
                            <div className="text-sm text-gray-500">
                              {((amount as number / (reportData.totalCollected ?? 1)) * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-2xl font-bold mt-2">{formatCurrency(amount as number)}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Recent Payments</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.recentPayments?.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.paymentDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{payment.invoice?.invoiceNumber || `#${payment.invoiceId}`}</TableCell>
                          <TableCell className="capitalize">{payment.method}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>{payment.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
