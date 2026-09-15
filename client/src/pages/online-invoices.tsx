import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Search, Printer, PackageSearch, QrCode, Truck, PackageCheck, PackageX, Undo2, HandCoins, Trash2 } from "lucide-react";
import { onlineOrderAPI, bankAccountAPI, paymentMethodAPI, type Invoice } from "@/service/api";
import { PrintInvoice } from "@/components/invoices/print-invoice";
import { QrScannerDialog } from "@/components/scanner/qr-scanner-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { formatPKR } from "@/utils/currency";
import {
  sourceBadgeClasses,
  fulfillmentBadge,
  resolutionLabel,
  totalPaid,
  suggestedRefund,
} from "@/utils/online-orders";

// Plain-language summary of what Deleting this order will reverse - shown
// in the confirmation dialog before anything actually moves.
function deleteSummary(invoice: Invoice): string {
  const order = invoice.onlineOrder;
  const itemCount = (invoice.items || []).reduce((sum, item) => sum + item.quantity, 0);
  const paidTotal = totalPaid(invoice);
  const refundTotal = (invoice.orderRefunds || []).reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);

  const parts: string[] = [];
  if (order && !order.stockReturnedAt && itemCount > 0) {
    parts.push(`restore ${itemCount} item${itemCount === 1 ? "" : "s"} to stock`);
  }
  if (paidTotal > 0) parts.push(`reverse ${formatPKR(paidTotal)} in payments`);
  if (refundTotal > 0) parts.push(`reverse ${formatPKR(refundTotal)} already refunded`);

  if (parts.length === 0) {
    return "This order has no stock or payments to reverse - it will simply be removed. This action cannot be undone.";
  }
  return `This will ${parts.join(", and ")}. This action cannot be undone.`;
}

// The single home for both Online Order history AND management - mirrors
// how the main Invoices page is the one place for both invoice history and
// Return/Exchange actions. Every online order shows here regardless of
// status, with whatever actions its current state allows.
export default function OnlineInvoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [deliverTarget, setDeliverTarget] = useState<Invoice | null>(null);
  const [deliverAmount, setDeliverAmount] = useState("");
  const [deliverMethod, setDeliverMethod] = useState("cash");
  const [deliverBankAccountId, setDeliverBankAccountId] = useState("");

  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundBankAccountId, setRefundBankAccountId] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canDelete = hasRole(["ShopOwner", "SuperAdmin"]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/online-orders"],
    queryFn: () => onlineOrderAPI.getAll(),
    refetchOnWindowFocus: "always",
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["shop-bank-accounts"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: !!deliverTarget || !!refundTarget,
  });

  const filteredOrders = orders?.filter((invoice) => {
    if (!searchTerm) return true;
    const order = invoice.onlineOrder;
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.customer?.name?.toLowerCase().includes(searchLower) ||
      invoice.customer?.phone?.toLowerCase().includes(searchLower) ||
      order?.source?.toLowerCase().includes(searchLower) ||
      order?.fulfillmentStatus?.toLowerCase().includes(searchLower)
    );
  });

  const handlePrint = (invoice: Invoice) => {
    setPrintInvoice(invoice);
    setPrintModalOpen(true);
  };

  // Scan a receipt's QR (the invoice id) and jump straight to it - same
  // "Scan Invoice" pattern as the main Invoices page, just resolved against
  // the online-orders endpoint so a Record Sale invoice's QR correctly
  // reports "not an online order" instead of silently doing nothing.
  const handleScanInvoice = async (decodedText: string) => {
    try {
      const found = await onlineOrderAPI.getById(parseInt(decodedText.trim(), 10));
      setSearchTerm(found.invoiceNumber);
      toast({ title: "Order found", description: `Showing ${found.invoiceNumber}.` });
    } catch (error: any) {
      const message = error?.response?.data?.message || "No online order found for this code.";
      toast({ title: "Scan failed", description: message, variant: "destructive" });
    }
  };

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/online-orders"] });
  };

  const shipMutation = useMutation({
    mutationFn: (id: number) => onlineOrderAPI.ship(id),
    onSuccess: () => {
      invalidateOrders();
      toast({ title: "Order marked shipped" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: ({ id, payment }: { id: number; payment?: { amount: number; method: string; bank_account_id?: number } }) =>
      onlineOrderAPI.deliver(id, payment),
    onSuccess: () => {
      invalidateOrders();
      toast({ title: "Order marked delivered" });
      setDeliverTarget(null);
      setDeliverAmount("");
      setDeliverBankAccountId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => onlineOrderAPI.cancel(id, reason),
    onSuccess: () => {
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Order cancelled" });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to cancel", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const confirmStockMutation = useMutation({
    mutationFn: (id: number) => onlineOrderAPI.confirmStockReceived(id),
    onSuccess: () => {
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Stock confirmed received" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount, method, bank_account_id }: { id: number; amount: number; method: string; bank_account_id?: number }) =>
      onlineOrderAPI.refund(id, { amount, method, bank_account_id }),
    onSuccess: () => {
      invalidateOrders();
      toast({ title: "Refund recorded" });
      setRefundTarget(null);
      setRefundAmount("");
      setRefundBankAccountId("");
    },
    onError: (error: any) => {
      toast({ title: "Refund failed", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => onlineOrderAPI.delete(id),
    onSuccess: () => {
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Order deleted", description: "Stock and payments have been reversed where applicable." });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const openDeliverDialog = (invoice: Invoice) => {
    setDeliverTarget(invoice);
    setDeliverAmount(invoice.remainingAmount > 0 ? invoice.remainingAmount.toString() : "");
    setDeliverMethod("cash");
    setDeliverBankAccountId("");
  };

  const openRefundDialog = (invoice: Invoice) => {
    setRefundTarget(invoice);
    setRefundAmount(suggestedRefund(invoice).toString());
    setRefundMethod("cash");
    setRefundBankAccountId("");
  };

  const deliverRequiresBank = paymentMethods.find((pm) => pm.value === deliverMethod)?.requiresBankAccount ?? false;
  const refundRequiresBank = paymentMethods.find((pm) => pm.value === refundMethod)?.requiresBankAccount ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-poppins font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center">
          <PackageSearch className="h-6 w-6 mr-2" />
          Online Invoices
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Full history of orders placed through Online Orders, and where their status is managed
        </p>
      </div>

      {printInvoice && (
        <PrintInvoice
          invoice={printInvoice}
          open={printModalOpen}
          onOpenChange={setPrintModalOpen}
        />
      )}

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanSuccess={handleScanInvoice}
        title="Scan Online Order QR Code"
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-3">
            <CardTitle className="font-poppins">All Online Invoices</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                onClick={() => setScannerOpen(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan Invoice
              </Button>
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by order #, customer, source, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Delivery Address</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && (!filteredOrders || filteredOrders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {searchTerm ? "No online invoices found matching your search." : "No online orders have been placed yet."}
                  </TableCell>
                </TableRow>
              )}
              {filteredOrders?.map((invoice) => {
                const order = invoice.onlineOrder;
                if (!order) return null;
                const badge = fulfillmentBadge(order.fulfillmentStatus);
                const label = resolutionLabel(order);
                const paid = totalPaid(invoice);

                return (
                  <TableRow key={invoice.id} className="table-row-hover">
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sourceBadgeClasses(order.source)}>
                        <span className="capitalize">{order.source}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{invoice.customer?.name || "-"}</span>
                        {invoice.customer?.phone && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer.phone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-normal break-words text-sm">{order.deliveryAddress}</TableCell>
                    <TableCell className="text-right">{formatPKR(invoice.netAmount)}</TableCell>
                    <TableCell className="text-right">{formatPKR(paid)}</TableCell>
                    <TableCell className="text-right">{formatPKR(invoice.remainingAmount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>
                        {label && (
                          <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-normal break-words max-w-[180px]">{label}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => handlePrint(invoice)}
                          title="Print Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {order.fulfillmentStatus === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800"
                            title="Mark Shipped"
                            onClick={() => {
                              if (window.confirm(`Mark ${invoice.invoiceNumber} as shipped?`)) shipMutation.mutate(invoice.id);
                            }}
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                        )}
                        {order.fulfillmentStatus === "shipped" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-800"
                            title="Mark Delivered"
                            onClick={() => openDeliverDialog(invoice)}
                          >
                            <PackageCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {(order.fulfillmentStatus === "pending" || order.fulfillmentStatus === "shipped") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            title="Cancel Order"
                            onClick={() => {
                              setCancelTarget(invoice);
                              setCancelReason("");
                            }}
                          >
                            <PackageX className="h-4 w-4" />
                          </Button>
                        )}
                        {order.fulfillmentStatus === "cancelled" && order.shippedAt && !order.stockReturnedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:text-indigo-800"
                            title="Confirm Stock Received"
                            onClick={() => {
                              if (window.confirm(`Confirm stock for ${invoice.invoiceNumber} is physically back?`)) {
                                confirmStockMutation.mutate(invoice.id);
                              }
                            }}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                        {order.fulfillmentStatus === "cancelled" && !order.refundedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-800"
                            title="Issue Refund"
                            onClick={() => openRefundDialog(invoice)}
                          >
                            <HandCoins className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            title="Delete Order"
                            onClick={() => setDeleteTarget(invoice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              {cancelTarget?.onlineOrder?.fulfillmentStatus === "shipped"
                ? "This order has already shipped - stock stays deducted until Confirm Stock Received is triggered separately once the parcel is physically back."
                : "This order hasn't shipped yet - stock will be restored automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="e.g. Customer changed their mind, failed delivery attempt..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Back</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver dialog */}
      <Dialog open={!!deliverTarget} onOpenChange={(open) => !open && setDeliverTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Delivered</DialogTitle>
            <DialogDescription>
              Optionally collect the remaining balance now (e.g. Cash on Delivery). Leave the amount at 0 to just mark delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Collected Now</Label>
              <DecimalInput value={deliverAmount} onChange={(e) => setDeliverAmount(e.target.value)} placeholder="0" />
              {deliverTarget && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Remaining balance: {formatPKR(deliverTarget.remainingAmount)}</p>
              )}
            </div>
            {parseFloat(deliverAmount) > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <RadioGroup value={deliverMethod} onValueChange={(v) => { setDeliverMethod(v); setDeliverBankAccountId(""); }} className="flex flex-wrap gap-4">
                    {paymentMethods.map((pm) => (
                      <div key={pm.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={pm.value} id={`deliver-${pm.value}`} />
                        <Label htmlFor={`deliver-${pm.value}`} className="cursor-pointer font-normal">{pm.name}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                {deliverRequiresBank && (
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Select value={deliverBankAccountId} onValueChange={setDeliverBankAccountId}>
                      <SelectTrigger><SelectValue placeholder="Choose bank account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.account_id} value={account.account_id.toString()}>
                            {account.account_name} • {account.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverTarget(null)}>Back</Button>
            <Button
              disabled={deliverMutation.isPending}
              onClick={() => {
                if (!deliverTarget) return;
                const amount = parseFloat(deliverAmount) || 0;
                deliverMutation.mutate({
                  id: deliverTarget.id,
                  payment: amount > 0
                    ? {
                        amount,
                        method: deliverMethod,
                        ...(deliverRequiresBank && deliverBankAccountId ? { bank_account_id: parseInt(deliverBankAccountId, 10) } : {}),
                      }
                    : undefined,
                });
              }}
            >
              {deliverMutation.isPending ? "Saving..." : "Mark Delivered"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Suggested amount is pre-filled per the cancellation rule — edit it if needed. Money only moves when you confirm here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Refund Amount</Label>
              <DecimalInput value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Refund Method</Label>
              <RadioGroup value={refundMethod} onValueChange={(v) => { setRefundMethod(v); setRefundBankAccountId(""); }} className="flex flex-wrap gap-4">
                {paymentMethods.map((pm) => (
                  <div key={pm.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={pm.value} id={`refund-${pm.value}`} />
                    <Label htmlFor={`refund-${pm.value}`} className="cursor-pointer font-normal">{pm.name}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {refundRequiresBank && (
              <div className="space-y-2">
                <Label>Bank Account</Label>
                <Select value={refundBankAccountId} onValueChange={setRefundBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choose bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name} • {account.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Back</Button>
            <Button
              disabled={refundMutation.isPending}
              onClick={() => {
                if (!refundTarget) return;
                const amount = parseFloat(refundAmount) || 0;
                if (amount <= 0) {
                  toast({ title: "Invalid amount", description: "Enter a positive refund amount.", variant: "destructive" });
                  return;
                }
                if (refundRequiresBank && !refundBankAccountId) {
                  toast({ title: "Bank account required", variant: "destructive" });
                  return;
                }
                refundMutation.mutate({
                  id: refundTarget.id,
                  amount,
                  method: refundMethod,
                  ...(refundRequiresBank && refundBankAccountId ? { bank_account_id: parseInt(refundBankAccountId, 10) } : {}),
                });
              }}
            >
              {refundMutation.isPending ? "Recording..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (Admin only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? deleteSummary(deleteTarget) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
