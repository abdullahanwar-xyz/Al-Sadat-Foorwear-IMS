import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BackendLayout } from "@/components/layout/backend-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Landmark, Wallet, Smartphone, TrendingUp, TrendingDown, Wallet2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { formatPKR } from "@/utils/currency";
import { businessReportsAPI, type DailyCashAccountSummary } from "@/service/api";
import { format } from "date-fns";

function todayDateInputValue() {
  return new Date().toISOString().split("T")[0];
}

function accountIcon(accountType: string) {
  if (accountType === "bank") return Landmark;
  if (accountType === "wallet") return Smartphone;
  return Wallet;
}

function transactionIcon(type: string) {
  if (type === "deposit" || type === "transfer_in") return ArrowDownCircle;
  if (type === "withdrawal" || type === "transfer_out") return ArrowUpCircle;
  return ArrowLeftRight;
}

function AccountCard({ account }: { account: DailyCashAccountSummary }) {
  const Icon = accountIcon(account.accountType);
  const isPositiveNet = account.netToday >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-500" />
          <CardTitle className="text-base font-semibold">{account.accountName}</CardTitle>
          <Badge variant="outline" className="uppercase text-[10px]">{account.accountType}</Badge>
        </div>
        {isPositiveNet ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ending Balance Today</p>
          <p className="text-2xl font-bold">{formatPKR(account.endingBalance)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Opening {formatPKR(account.openingBalance)} + Received {formatPKR(account.moneyIn)} − Paid Out {formatPKR(account.moneyOut)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Money In</p>
            <p className="font-semibold text-green-600">{formatPKR(account.moneyIn)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Money Out</p>
            <p className="font-semibold text-red-600">{formatPKR(account.moneyOut)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net</p>
            <p className={`font-semibold ${isPositiveNet ? "text-green-600" : "text-red-600"}`}>
              {isPositiveNet ? "+" : ""}{formatPKR(account.netToday)}
            </p>
          </div>
        </div>

        {account.transactions.length > 0 ? (
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {account.transactions.map((t) => {
              const TIcon = transactionIcon(t.transactionType);
              const isIn = t.transactionType === "deposit" || t.transactionType === "transfer_in";
              return (
                <div key={t.flowId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <TIcon className={`h-4 w-4 shrink-0 ${isIn ? "text-green-600" : "text-red-600"}`} />
                    <div className="min-w-0">
                      <p className="truncate">{t.description || t.transactionType.replace("_", " ")}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(t.time), "h:mm a")} • {t.transactionType.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <span className={`font-medium whitespace-nowrap ${isIn ? "text-green-600" : "text-red-600"}`}>
                    {isIn ? "+" : "-"}{formatPKR(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-center text-slate-400 py-4">No transactions on this account today.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BackendDailyCashSummary() {
  const [selectedDate, setSelectedDate] = useState(todayDateInputValue());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["daily-cash-summary", selectedDate],
    queryFn: () => businessReportsAPI.getDailyCashSummary(selectedDate),
  });

  const summary = data?.data;

  return (
    <BackendLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <Wallet2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                Daily Cash Summary
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                What moved in every account today, and what's left to count against the drawer
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="summary-date" className="text-xs">Date</Label>
              <Input
                id="summary-date"
                type="date"
                value={selectedDate}
                max={todayDateInputValue()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button variant="outline" onClick={() => setSelectedDate(todayDateInputValue())}>
              Today
            </Button>
          </div>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="p-16 text-center text-slate-500">Loading...</CardContent>
          </Card>
        )}

        {isError && (
          <Card>
            <CardContent className="p-16 text-center text-red-600">
              Failed to load the daily cash summary. Please try again.
            </CardContent>
          </Card>
        )}

        {summary && (
          <>
            {/* Grand total */}
            <Card className="border-indigo-200 dark:border-indigo-800">
              <CardHeader>
                <CardTitle className="text-base">
                  Grand Total — {format(new Date(`${summary.date}T00:00:00`), "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Opening</p>
                    <p className="text-lg font-semibold">{formatPKR(summary.grandTotal.openingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Money In</p>
                    <p className="text-lg font-semibold text-green-600">{formatPKR(summary.grandTotal.moneyIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Money Out</p>
                    <p className="text-lg font-semibold text-red-600">{formatPKR(summary.grandTotal.moneyOut)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Net</p>
                    <p className={`text-lg font-semibold ${summary.grandTotal.netToday >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {summary.grandTotal.netToday >= 0 ? "+" : ""}{formatPKR(summary.grandTotal.netToday)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ending Balance</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatPKR(summary.grandTotal.endingBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-account cards */}
            {summary.accounts.length === 0 ? (
              <Card>
                <CardContent className="p-16 text-center text-slate-500">No active accounts found.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summary.accounts.map((account) => (
                  <AccountCard key={account.accountId} account={account} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </BackendLayout>
  );
}
