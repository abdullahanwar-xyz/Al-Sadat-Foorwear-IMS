import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cashFlowAPI, type BankAccount } from "@/service/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Landmark, Wallet, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from "lucide-react";

interface BankAccountDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

export function BankAccountDetailsModal({ open, onOpenChange, account }: BankAccountDetailsModalProps) {
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Fetch cash flows for this account
  const { data: cashFlows = [], isLoading } = useQuery({
    queryKey: ["cash-flows", account?.account_id, dateRange],
    queryFn: () =>
      cashFlowAPI.getAll({
        account_id: account!.account_id,
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      }),
    enabled: !!account,
  });

  if (!account) return null;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case "withdrawal":
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case "transfer_in":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case "transfer_out":
        return <ArrowRightLeft className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getTransactionBadge = (type: string) => {
    const badges = {
      deposit: <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Deposit</Badge>,
      withdrawal: <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Withdrawal</Badge>,
      transfer_in: <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Transfer In</Badge>,
      transfer_out: <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Transfer Out</Badge>,
    };
    return badges[type as keyof typeof badges] || <Badge>{type}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Details</DialogTitle>
          <DialogDescription>
            View account information and transaction history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Information */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-muted rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {account.account_type === "bank" ? (
                  <Landmark className="h-5 w-5 text-blue-600" />
                ) : (
                  <Wallet className="h-5 w-5 text-green-600" />
                )}
                <h3 className="font-semibold text-lg">{account.account_name}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Account Type</p>
                  <p className="font-medium capitalize">{account.account_type}</p>
                </div>
                {account.account_number && (
                  <div>
                    <p className="text-muted-foreground">Account Number</p>
                    <p className="font-mono text-sm">{account.account_number}</p>
                  </div>
                )}
                {account.bank_name && (
                  <div>
                    <p className="text-muted-foreground">Bank Name</p>
                    <p className="font-medium">{account.bank_name}</p>
                  </div>
                )}
                {account.branch && (
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-medium">{account.branch}</p>
                  </div>
                )}
                {account.ifsc_code && (
                  <div>
                    <p className="text-muted-foreground">IFSC/IBAN Code</p>
                    <p className="font-mono text-sm">{account.ifsc_code}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-muted-foreground text-sm">Opening Balance</p>
                <p className="text-2xl font-bold">
                  ₨{account.opening_balance.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Current Balance</p>
                <p
                  className={`text-3xl font-bold ${
                    account.current_balance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ₨{account.current_balance.toLocaleString()}
                </p>
              </div>
              {account.description && (
                <div>
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p className="text-sm">{account.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setDateRange({ startDate: "", endDate: "" })}
            >
              Clear Filter
            </Button>
          </div>

          {/* Transaction History */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Transaction History</h3>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading transactions...</p>
            ) : cashFlows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions found</p>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlows.map((flow) => (
                      <TableRow key={flow.flow_id}>
                        <TableCell className="font-medium">
                          {new Date(flow.transaction_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(flow.transaction_type)}
                            {getTransactionBadge(flow.transaction_type)}
                          </div>
                        </TableCell>
                        <TableCell>{flow.payment_method || "-"}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {flow.reference_number || "-"}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span
                            className={
                              flow.transaction_type === "deposit" || flow.transaction_type === "transfer_in"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {flow.transaction_type === "deposit" || flow.transaction_type === "transfer_in"
                              ? "+"
                              : "-"}
                            ₨{flow.amount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ₨{flow.balance_after?.toLocaleString() || "0"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {flow.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
