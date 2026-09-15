import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bankAccountAPI, cashFlowAPI, type BankAccount } from "@/service/api";
import { BackendLayout } from "@/components/layout/backend-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Landmark,
  Wallet,
  Smartphone,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Trash2,
} from "lucide-react";
import { formatPKR } from "@/utils/currency";
import { useToast } from "@/hooks/use-toast";
import {
  AddBankAccountModal,
  EditBankAccountModal,
  DepositModal,
  WithdrawModal,
  TransferModal,
  BankAccountDetailsModal,
} from "@/components/backend";

export default function BackendBanking() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bank accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountAPI.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bankAccountAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({
        title: "Success",
        description: "Bank account deleted successfully",
      });
      setDeleteAccountId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete bank account",
        variant: "destructive",
      });
      setDeleteAccountId(null);
    },
  });

  // Fetch cash flow summary
  const { data: cashFlowSummary } = useQuery({
    queryKey: ["cash-flow-summary"],
    queryFn: () => cashFlowAPI.getSummary(),
  });

  // Calculate totals
  const totalBankBalance = accounts
    .filter((a) => a.account_type === "bank" && a.status === 1)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalCashBalance = accounts
    .filter((a) => a.account_type === "cash" && a.status === 1)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalWalletBalance = accounts
    .filter((a) => a.account_type === "wallet" && a.status === 1)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalBalance = totalBankBalance + totalCashBalance + totalWalletBalance;

  const activeAccounts = accounts.filter((a) => a.status === 1);
  const inactiveAccounts = accounts.filter((a) => a.status === 0);

  const handleEdit = (account: BankAccount) => {
    setSelectedAccount(account);
    setIsEditModalOpen(true);
  };

  const handleDeposit = (account: BankAccount) => {
    setSelectedAccount(account);
    setIsDepositModalOpen(true);
  };

  const handleWithdraw = (account: BankAccount) => {
    setSelectedAccount(account);
    setIsWithdrawModalOpen(true);
  };

  const handleViewDetails = (account: BankAccount) => {
    setSelectedAccount(account);
    setIsDetailsModalOpen(true);
  };

  return (
    <BackendLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Landmark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
              Banking & Cash Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage bank accounts and track cash flow
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsTransferModalOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Transfer
          </Button>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All active accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
            <Landmark className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(totalBankBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter((a) => a.account_type === "bank" && a.status === 1).length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash in Hand</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(totalCashBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter((a) => a.account_type === "cash" && a.status === 1).length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Accounts</CardTitle>
            <Smartphone className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(totalWalletBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter((a) => a.account_type === "wallet" && a.status === 1).length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            {(cashFlowSummary?.net_cash_flow || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (cashFlowSummary?.net_cash_flow || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatPKR(cashFlowSummary?.net_cash_flow || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active">
                Active Accounts ({activeAccounts.length})
              </TabsTrigger>
              <TabsTrigger value="inactive">
                Inactive ({inactiveAccounts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">Loading accounts...</div>
              ) : activeAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active accounts found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Bank/Branch</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAccounts.map((account) => {
                      const isShopCashRegister = account.account_name === "Shop Cash Register" && account.account_type === "cash";
                      
                      return (
                      <TableRow key={account.account_id} className={isShopCashRegister ? "bg-green-50 dark:bg-green-900/10" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {account.account_name}
                            {isShopCashRegister && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                                Default Cash
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.account_type === "bank" ? "default" : "secondary"}>
                            {account.account_type === "bank" ? (
                              <Landmark className="h-3 w-3 mr-1" />
                            ) : account.account_type === "wallet" ? (
                              <Smartphone className="h-3 w-3 mr-1" />
                            ) : (
                              <Wallet className="h-3 w-3 mr-1" />
                            )}
                            {account.account_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {account.bank_name || "—"}
                            </div>
                            {account.branch && (
                              <div className="text-xs text-muted-foreground">
                                {account.branch}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {account.account_number || "—"}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-bold ${
                              account.current_balance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatPKR(account.current_balance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeposit(account)}
                              className="text-green-600 hover:text-green-700"
                            >
                              Deposit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWithdraw(account)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Withdraw
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(account)}
                            >
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteAccountId(account.account_id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="inactive" className="mt-6">
              {inactiveAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No inactive accounts
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveAccounts.map((account) => (
                      <TableRow key={account.account_id} className="opacity-60">
                        <TableCell className="font-medium">
                          {account.account_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {account.account_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{account.bank_name || "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatPKR(account.current_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(account)}
                            >
                              Activate
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteAccountId(account.account_id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Modals */}
      <AddBankAccountModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />

      {selectedAccount && (
        <>
          <EditBankAccountModal
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            account={selectedAccount}
          />

          <DepositModal
            open={isDepositModalOpen}
            onOpenChange={setIsDepositModalOpen}
            account={selectedAccount}
          />

          <WithdrawModal
            open={isWithdrawModalOpen}
            onOpenChange={setIsWithdrawModalOpen}
            account={selectedAccount}
          />

          <BankAccountDetailsModal
            open={isDetailsModalOpen}
            onOpenChange={setIsDetailsModalOpen}
            account={selectedAccount}
          />
        </>
      )}

      <TransferModal
        open={isTransferModalOpen}
        onOpenChange={setIsTransferModalOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteAccountId !== null} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this bank account. This action cannot be undone.
              Accounts with existing transaction history cannot be deleted - deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountId && deleteMutation.mutate(deleteAccountId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </BackendLayout>
  );
}
