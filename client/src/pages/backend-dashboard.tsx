import { useQuery } from "@tanstack/react-query";
import { supplierTransactionAPI } from "@/service/api";
import { BackendLayout } from "@/components/layout/backend-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Receipt, Wallet, TrendingDown } from "lucide-react";
import { formatPKR } from "@/utils/currency";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function BackendDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["backend-dashboard-stats"],
    queryFn: () => supplierTransactionAPI.getDashboardStats(),
  });

  const kpiCards = [
    {
      title: "Total Suppliers",
      value: stats?.totalSuppliers || 0,
      icon: Users,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
    {
      title: "Total Transactions",
      value: stats?.totalTransactions || 0,
      icon: Receipt,
      color: "text-purple-500",
      bgColor: "bg-purple-100 dark:bg-purple-950",
    },
    {
      title: "Owed to Suppliers",
      value: formatPKR(stats?.totalOwedToSuppliers || 0),
      icon: TrendingDown,
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-950",
      isAmount: true,
    },
    {
      title: "Total Balance",
      value: formatPKR(stats?.totalBalance || 0),
      icon: Wallet,
      color: "text-orange-500",
      bgColor: "bg-orange-100 dark:bg-orange-950",
      isAmount: true,
    },
  ];

  return (
    <BackendLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts & Finance</h1>
          <p className="text-muted-foreground">
            Overview of your financial management system
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <div className={`rounded-full p-2 ${card.bgColor}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{card.value}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : stats && stats.recentTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.trans_id}>
                      <TableCell>
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.supplier?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.type === "purchase" ? "default" : "secondary"
                          }
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPKR(transaction.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPKR(transaction.amount_paid)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No transactions yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BackendLayout>
  );
}
