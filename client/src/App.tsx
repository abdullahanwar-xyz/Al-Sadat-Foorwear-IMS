import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getLandingPathForRole, ADMIN_ROLES, SALESMAN_ROLES, PRODUCT_ENTRY_ROLES } from "@/lib/roles";

import { MainLayout } from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Invoices from "@/pages/invoices";
import RecordSale from "@/pages/record-sale";
import OnlineOrders from "@/pages/online-orders";
import OnlineInvoices from "@/pages/online-invoices";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

// Accounts & Finance Pages
import BackendDashboard from "@/pages/backend-dashboard";
import BackendSuppliers from "@/pages/backend-suppliers";
import BackendTransactions from "@/pages/backend-transactions";
import BackendBanking from "@/pages/backend-banking";
import BackendReports from "@/pages/backend-reports";
import BackendSalesReports from "@/pages/backend-sales-reports";
import BackendDailyCashSummary from "@/pages/backend-daily-cash-summary";
import BackendUsers from "@/pages/backend-users";
import BackendPaymentMethods from "@/pages/backend-payment-methods";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to={getLandingPathForRole(user?.user_type)} /> : <Login />}
      </Route>

      {/* Protected routes */}
      {isAuthenticated ? (
        <Route>
          <Switch>
            {/* Accounts & Finance Routes (Outside MainLayout) */}
            <Route path="/backend">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendDashboard /></ProtectedRoute>
            </Route>
            <Route path="/backend/suppliers">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendSuppliers /></ProtectedRoute>
            </Route>
            <Route path="/backend/transactions">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendTransactions /></ProtectedRoute>
            </Route>
            <Route path="/backend/banking">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendBanking /></ProtectedRoute>
            </Route>
            <Route path="/backend/reports">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendReports /></ProtectedRoute>
            </Route>
            <Route path="/backend/sales-reports">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendSalesReports /></ProtectedRoute>
            </Route>
            <Route path="/backend/daily-cash-summary">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendDailyCashSummary /></ProtectedRoute>
            </Route>
            <Route path="/backend/users">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendUsers /></ProtectedRoute>
            </Route>
            <Route path="/backend/payment-methods">
              <ProtectedRoute roles={ADMIN_ROLES}><BackendPaymentMethods /></ProtectedRoute>
            </Route>

            {/* Shop Routes (Inside MainLayout) */}
            <Route>
              <MainLayout>
                <Switch>
                  <Route path="/">
                    <ProtectedRoute roles={ADMIN_ROLES}><Dashboard /></ProtectedRoute>
                  </Route>
                  <Route path="/inventory">
                    <ProtectedRoute roles={PRODUCT_ENTRY_ROLES}><Inventory /></ProtectedRoute>
                  </Route>
                  <Route path="/invoices">
                    <ProtectedRoute roles={SALESMAN_ROLES}><Invoices /></ProtectedRoute>
                  </Route>
                  <Route path="/record-sale">
                    <ProtectedRoute roles={SALESMAN_ROLES}><RecordSale /></ProtectedRoute>
                  </Route>
                  <Route path="/online-orders">
                    <ProtectedRoute roles={SALESMAN_ROLES}><OnlineOrders /></ProtectedRoute>
                  </Route>
                  <Route path="/online-invoices">
                    <ProtectedRoute roles={SALESMAN_ROLES}><OnlineInvoices /></ProtectedRoute>
                  </Route>
                  <Route path="/settings">
                    <ProtectedRoute roles={ADMIN_ROLES}><Settings /></ProtectedRoute>
                  </Route>
                  <Route component={NotFound} />
                </Switch>
              </MainLayout>
            </Route>
          </Switch>
        </Route>
      ) : (
        <Route>
          <Redirect to="/login" />
        </Route>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
