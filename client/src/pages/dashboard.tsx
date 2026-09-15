import { useQuery } from "@tanstack/react-query";
import { AnimatedKPICard } from "../components/ui/animated-kpi-card";
import { AdvancedTable } from "../components/ui/advanced-table";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { TrendingUp, AlertTriangle, Package, Boxes, Truck } from "lucide-react";
import { format, isToday, subDays } from "date-fns";
import { invoiceAPI, productAPI, returnAPI, onlineOrderAPI } from "../service/api";
import { useToast } from "../hooks/use-toast";
import { computeInvoiceBreakdown, getReturnSummary } from "../utils/returns";
import React from "react";

const LOW_STOCK_THRESHOLD = 3;

export default function Dashboard() {
  const { toast } = useToast();

  // Fetch invoices. Drives "Today's Sales" and "Recent Transactions", so
  // this needs the same window-focus refetch as the products query below -
  // 'always', not `true`, since the global QueryClient's staleTime: Infinity
  // makes `true` a no-op (it only refetches stale data).
  const {
    data: invoices,
    isLoading: isLoadingInvoices,
    isError: isErrorInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: () => invoiceAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  // Fetch products (for low stock + total product counts). Stock-sensitive,
  // so this stays reasonably fresh: refetch on window focus and poll every
  // 30s while the tab is visible (refetchIntervalInBackground defaults to
  // false, so it won't poll a backgrounded tab).
  const {
    data: products,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
    error: productsError,
  } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    // The global QueryClient sets staleTime: Infinity, under which plain
    // `true` here would never actually refetch (it only refetches stale
    // data) - 'always' forces it regardless of staleness.
    refetchOnWindowFocus: "always",
    refetchInterval: 30000,
  });

  // Refunds, so "Today's Sales" can net out same-day returns instead of
  // showing gross sales as if nothing had come back.
  const {
    data: returns,
    isLoading: isLoadingReturns,
    isError: isErrorReturns,
    error: returnsError,
  } = useQuery({
    queryKey: ["/api/returns"],
    queryFn: () => returnAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  // Online Orders live entirely outside invoiceAPI.getAll() (that endpoint
  // deliberately excludes them - see invoiceController.getAll). Fetched
  // separately so Today's Sales can be split Store vs. Online, and merged
  // back into Recent Transactions below.
  const {
    data: onlineOrders,
    isLoading: isLoadingOnlineOrders,
    isError: isErrorOnlineOrders,
    error: onlineOrdersError,
  } = useQuery({
    queryKey: ["/api/online-orders"],
    queryFn: () => onlineOrderAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  const isLoading = isLoadingInvoices || isLoadingProducts || isLoadingReturns || isLoadingOnlineOrders;
  // Only treat this as a blocking error when there's no cached data to fall
  // back on (a genuine initial-load failure). Once data has loaded once,
  // a failed background refetch (window focus / periodic poll) shouldn't
  // hide the dashboard - react-query keeps the last-good data around.
  const isError = (isErrorInvoices && !invoices) || (isErrorProducts && !products) || (isErrorReturns && !returns) || (isErrorOnlineOrders && !onlineOrders);

  // Effect (not render body) so this only fires when the error state
  // actually changes - see the same fix on the Inventory page.
  React.useEffect(() => {
    if (isErrorInvoices && invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
    }
    if (isErrorProducts && productsError) {
      console.error("Error fetching products:", productsError);
    }
    if (isErrorReturns && returnsError) {
      console.error("Error fetching returns:", returnsError);
    }
    if (isErrorOnlineOrders && onlineOrdersError) {
      console.error("Error fetching online orders:", onlineOrdersError);
    }
    if (isError) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    }
  }, [isErrorInvoices, invoicesError, isErrorProducts, productsError, isErrorReturns, returnsError, isErrorOnlineOrders, onlineOrdersError, isError, toast]);

  // Calculate dashboard statistics from real data
  const dashboardStats = React.useMemo(() => {
    if (!invoices) return {};

    // Get today's date
    const today = new Date();
    const yesterday = subDays(today, 1);

    // Today's Sales - real transaction-based: every Payment recorded today
    // (original sale payments AND exchange top-up settlements alike) minus
    // every Refund recorded today. Deliberately NOT filtered by the
    // invoice's own status or date - only by the payment/refund's own
    // date. This is what actually moved money today, regardless of when
    // the invoice it's against was originally created.
    //
    // Split Store vs. Online: invoiceAPI.getAll() already excludes every
    // Online Order invoice (see invoiceController.getAll), so `invoices`
    // here is Store-only and `onlineOrders` (fetched separately) is the
    // Online-only counterpart - an advance-only online payment already
    // shows only the actual amount collected, with no extra logic needed.
    const allStorePayments = invoices.flatMap((invoice) => invoice.payments || []);
    const allStoreRefunds = (returns || []).flatMap((r) => r.refunds || []);
    const allOnlinePayments = (onlineOrders || []).flatMap((invoice) => invoice.payments || []);
    const allOnlineRefunds = (onlineOrders || []).flatMap((invoice) => invoice.orderRefunds || []);

    const sameDay = (dateStr: string, reference: Date) => {
      const d = new Date(dateStr);
      return d.getDate() === reference.getDate() &&
        d.getMonth() === reference.getMonth() &&
        d.getFullYear() === reference.getFullYear();
    };

    const sumToday = (rows: { amount: number | string }[], dateField: (r: any) => string) =>
      rows.filter((r) => isToday(new Date(dateField(r)))).reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
    const sumYesterday = (rows: { amount: number | string }[], dateField: (r: any) => string) =>
      rows.filter((r) => sameDay(dateField(r), yesterday)).reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);

    const todayStorePayments = sumToday(allStorePayments, (p) => p.paymentDate);
    const yesterdayStorePayments = sumYesterday(allStorePayments, (p) => p.paymentDate);
    const todayStoreRefunds = sumToday(allStoreRefunds, (r) => r.refundDate);
    const yesterdayStoreRefunds = sumYesterday(allStoreRefunds, (r) => r.refundDate);
    const todayStoreSales = todayStorePayments - todayStoreRefunds;
    const yesterdayStoreSales = yesterdayStorePayments - yesterdayStoreRefunds;

    const todayOnlinePayments = sumToday(allOnlinePayments, (p) => p.paymentDate);
    const yesterdayOnlinePayments = sumYesterday(allOnlinePayments, (p) => p.paymentDate);
    const todayOnlineRefunds = sumToday(allOnlineRefunds, (r) => r.refundDate);
    const yesterdayOnlineRefunds = sumYesterday(allOnlineRefunds, (r) => r.refundDate);
    const todayOnlineSales = todayOnlinePayments - todayOnlineRefunds;
    const yesterdayOnlineSales = yesterdayOnlinePayments - yesterdayOnlineRefunds;

    // "N sales today" counts distinct invoices that received an original
    // sale payment today (a returnId means it's a later exchange top-up
    // against an existing sale, not a new sale happening today) AND still
    // have some remaining, non-returned value - a sale fully refunded the
    // same day contributed ₨0 net revenue, so it shouldn't count as an
    // active sale either, same "fully returned = effectively ₨0" logic as
    // computeInvoiceBreakdown. A partially-returned sale still counts.
    const todaysStoreSaleInvoiceIds = new Set(
      invoices
        .filter((invoice) => (invoice.payments || []).some((p) => !p.returnId && isToday(new Date(p.paymentDate))))
        .filter((invoice) => !getReturnSummary(invoice.items).isFullyReturned)
        .map((invoice) => invoice.id)
    );
    const todaysOnlineSaleInvoiceIds = new Set(
      (onlineOrders || [])
        .filter((invoice) => (invoice.payments || []).some((p) => isToday(new Date(p.paymentDate))))
        .map((invoice) => invoice.id)
    );

    // Calculate sales trend percentages
    const storeSalesTrend = yesterdayStoreSales === 0
      ? 100
      : ((todayStoreSales - yesterdayStoreSales) / yesterdayStoreSales) * 100;
    const onlineSalesTrend = yesterdayOnlineSales === 0
      ? 100
      : ((todayOnlineSales - yesterdayOnlineSales) / yesterdayOnlineSales) * 100;

    // Low stock: count of size/color combinations at or below the threshold
    const lowStockCount = (products || []).reduce((count, product) => {
      const productLowStockSizes = (product.colorRates || []).reduce((colorCount, colorRate) => {
        const sizesAtOrBelowThreshold = (colorRate.sizes || []).filter(
          (size) => size.quantity <= LOW_STOCK_THRESHOLD
        ).length;
        return colorCount + sizesAtOrBelowThreshold;
      }, 0);
      return count + productLowStockSizes;
    }, 0);

    // Recent transactions (sorted by date, most recent first) - Store and
    // Online together, since this is just a history list, not a total.
    // Amounts use the same current-Net calculation as the Invoices list's
    // Amount column (Original - Refunded + Additional Paid) - a
    // fully-returned invoice shows ₨0 here too, instead of the stale
    // original amount it was sold for.
    const recentTransactions = [...invoices, ...(onlineOrders || [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(invoice => {
        const breakdown = computeInvoiceBreakdown(invoice.items, invoice.returns, invoice.payments, invoice.netAmount);
        const currentNetAmount = breakdown.netAmount;

        let paidAmount = 0;
        if (invoice.status === 'paid') {
          paidAmount = currentNetAmount;
        } else if (invoice.status === 'partial') {
          paidAmount = currentNetAmount - parseFloat(invoice.remainingAmount.toString());
        }

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer,
          netAmount: currentNetAmount.toString(),
          paidAmount: paidAmount.toString(),
          invoiceDate: invoice.date,
          status: invoice.status,
          source: invoice.onlineOrder?.source || null,
        };
      });

    // Total stock: sum of pieces across every product/color/size combination
    // (same calculation used for "Total Stock" on the Inventory page).
    const totalStock = (products || []).reduce((total, product) =>
      total + (product.colorRates?.reduce((colorTotal, cr) =>
        colorTotal + (cr.sizes?.reduce((sizeTotal, size) => sizeTotal + size.quantity, 0) || 0), 0
      ) || 0), 0
    );

    return {
      totalStoreSalesToday: todayStoreSales,
      storeSalesCountToday: todaysStoreSaleInvoiceIds.size,
      storeSalesTrend,
      totalOnlineSalesToday: todayOnlineSales,
      onlineSalesCountToday: todaysOnlineSaleInvoiceIds.size,
      onlineSalesTrend,
      lowStockCount,
      totalProducts: products?.length || 0,
      totalStock,
      recentTransactions
    };
  }, [invoices, products, returns, onlineOrders]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-sora font-bold text-slate-800 dark:text-slate-100 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Welcome back! Here's your business overview.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <Card>
          <CardContent className="text-center p-6 text-red-600 dark:text-red-400">
            Failed to load dashboard data. Please refresh and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-sora font-bold text-slate-800 dark:text-slate-100 mb-2">
            Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Welcome back! Here's your business overview.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Animated KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <AnimatedKPICard
          title="Today's Sale (Store)"
          value={`${dashboardStats?.totalStoreSalesToday?.toLocaleString() || 0}`}
          icon={<TrendingUp className="h-6 w-6" />}
          trend={dashboardStats?.storeSalesTrend !== undefined ? Number(dashboardStats.storeSalesTrend.toFixed(1)) : 0}
          subtitle={`${dashboardStats?.storeSalesCountToday || 0} sale${dashboardStats?.storeSalesCountToday === 1 ? '' : 's'} today`}
          gradient="indigo"
          showBadge
          badgeText="Received"
        />
        <AnimatedKPICard
          title="Today's Sale (Online)"
          value={`${dashboardStats?.totalOnlineSalesToday?.toLocaleString() || 0}`}
          icon={<Truck className="h-6 w-6" />}
          trend={dashboardStats?.onlineSalesTrend !== undefined ? Number(dashboardStats.onlineSalesTrend.toFixed(1)) : 0}
          subtitle={`${dashboardStats?.onlineSalesCountToday || 0} order${dashboardStats?.onlineSalesCountToday === 1 ? '' : 's'} today`}
          gradient="purple"
          showBadge
          badgeText="Received"
        />
        <AnimatedKPICard
          title="Low Stock Alerts"
          value={dashboardStats?.lowStockCount || 0}
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={0}
          subtitle={`Sizes at or below ${LOW_STOCK_THRESHOLD} in stock`}
          gradient="orange"
          showBadge
          badgeText="Restock"
        />
        <AnimatedKPICard
          title="Total Designs"
          value={dashboardStats?.totalProducts || 0}
          icon={<Package className="h-6 w-6" />}
          trend={0}
          subtitle="Across all collections"
          gradient="blue"
          showBadge
          badgeText="Catalog"
        />
        <AnimatedKPICard
          title="Total Stock"
          value={dashboardStats?.totalStock || 0}
          icon={<Boxes className="h-6 w-6" />}
          trend={0}
          subtitle="Pieces across all designs"
          gradient="green"
          showBadge
          badgeText="Pairs"
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sora text-slate-800">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvancedTable
            data={dashboardStats?.recentTransactions || []}
            columns={[
              {
                id: "invoiceNumber",
                label: "Invoice",
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>
              },
              {
                id: "customer",
                label: "Customer",
                sortable: true,
                render: (value) => value?.name || "-"
              },
              {
                id: "source",
                label: "Channel",
                sortable: true,
                filterable: true,
                render: (value) => value ? (
                  <Badge variant="outline" className="capitalize">{value}</Badge>
                ) : (
                  <span className="text-xs text-slate-400">Store</span>
                )
              },
              {
                id: "netAmount",
                label: "Net Amount",
                sortable: true,
                render: (value) => parseFloat(value).toLocaleString()
              },
              {
                id: "paidAmount",
                label: "Paid Amount",
                sortable: true,
                render: (value) => parseFloat(value).toLocaleString()
              },
              {
                id: "invoiceDate",
                label: "Date",
                sortable: true,
                render: (value) => format(new Date(value), "MMM dd, yyyy")
              },
              {
                id: "status",
                label: "Status",
                sortable: true,
                filterable: true,
                render: (value) => (
                  <Badge
                    variant={
                      value === "paid"
                        ? "default"
                        : value === "pending"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {value}
                  </Badge>
                )
              }
            ]}
            searchPlaceholder="Search transactions..."
            pageSize={5}
            showPagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
