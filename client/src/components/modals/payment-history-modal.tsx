import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { DollarSign, CreditCard, Landmark, Wallet, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { paymentAPI } from "@/service/api";
import { useToast } from "@/hooks/use-toast";

interface PaymentHistoryModalProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentHistoryModal({ invoice, open, onOpenChange }: PaymentHistoryModalProps) {
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch payments for this invoice
  const { data: payments, isLoading } = useQuery({
    queryKey: [`/api/payments/invoice/${invoice.id}`, invoice.id],
    queryFn: () => paymentAPI.getByInvoiceId(invoice.id),
    enabled: open, // Only fetch when modal is open
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/payments/invoice/${invoice.id}`, invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flows"] });
      toast({ title: "Success", description: "Payment deleted successfully" });
      setDeletePaymentId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete payment",
        variant: "destructive",
      });
      setDeletePaymentId(null);
    },
  });

  // Calculate summary data
  const totalPaid = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;
  const invoiceTotal = parseFloat(invoice.netAmount);
  const remainingBalance = invoiceTotal - totalPaid;
  
  // Get icon for payment method
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <Wallet className="h-4 w-4 text-green-600" />;
      case "card":
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case "bank":
        return <Landmark className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Payment History - {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer</p>
              <p className="text-sm font-semibold">{invoice.customer?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Date</p>
              <p className="text-sm font-semibold">
                {format(new Date(invoice.date), "MMM dd, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
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
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4">
          <Card className="p-3 border-green-100 bg-green-50 dark:border-green-800 dark:bg-green-900/30">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Total</p>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{invoiceTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-3 border-blue-100 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Paid</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalPaid.toFixed(2)}</p>
          </Card>
          <Card className="p-3 border-red-100 bg-red-50 dark:border-red-800 dark:bg-red-900/30">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Balance</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{remainingBalance.toFixed(2)}</p>
          </Card>
        </div>
        
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-3">Payment Records</h3>
          
          {isLoading ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading payment records...</div>
          ) : payments?.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">No payment records found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(payment.method)}
                        <span className="capitalize">{payment.method}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {parseFloat(payment.amount.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletePaymentId(payment.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog open={deletePaymentId !== null} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the payment and reverse its effect on the bank/cash
              balance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePaymentId && deleteMutation.mutate(deletePaymentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
