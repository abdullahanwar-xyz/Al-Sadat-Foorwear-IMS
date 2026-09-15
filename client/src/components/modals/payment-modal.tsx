import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";
import { paymentAPI, bankAccountAPI, paymentMethodAPI, type CreatePaymentPayload } from "@/service/api";
import { getPaymentMethodIcon } from "@/lib/payment-method-icons";

interface PaymentModalProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentModal({ invoice, open, onOpenChange }: PaymentModalProps) {
  // Calculate remaining amount
  const paidAmount = invoice.payments?.reduce((sum: number, payment: any) =>
    sum + parseFloat(payment.amount), 0) || 0;
  const netAmount = Math.round(parseFloat(invoice.netAmount?.toString() || "0"));
const remainingAmount = netAmount - paidAmount;
  
  const [formData, setFormData] = useState({
    invoiceId: invoice.id,
    amount: remainingAmount.toFixed(2),
    method: "cash",
    bank_account_id: undefined as number | undefined,
    reference: "",
    notes: "",
    paymentDate: new Date().toISOString().split('T')[0],
  });

  // Update form data when invoice changes
  useEffect(() => {
    setFormData(prevData => ({
      ...prevData,
      invoiceId: invoice.id,
      amount: remainingAmount.toFixed(2),
    }));
  }, [invoice.id, remainingAmount]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
  });

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.value === formData.method);
  const requiresBankAccount = selectedPaymentMethod?.requiresBankAccount ?? false;

  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.some((pm) => pm.value === formData.method)) {
      setFormData((prev) => ({ ...prev, method: paymentMethods[0].value }));
    }
  }, [paymentMethods, formData.method]);

  // Fetch shop's personal bank accounts (only when the selected method needs one)
  const { data: shopBankAccounts = [] } = useQuery({
    queryKey: ["shop-bank-accounts"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: requiresBankAccount,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (paymentData: typeof formData) => {
      const methodRequiresBankAccount = paymentMethods.find((pm) => pm.value === paymentData.method)?.requiresBankAccount ?? false;
      // Ensure the invoice ID is correctly passed as a number
      const payload: CreatePaymentPayload = {
        invoiceId: Number(invoice.id),
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        paymentDate: new Date(paymentData.paymentDate),
        // Include bank_account_id if this payment method requires one
        ...(methodRequiresBankAccount && paymentData.bank_account_id && {
          bank_account_id: paymentData.bank_account_id
        }),
        // Only include these fields if they have values
        ...(paymentData.reference && { reference: paymentData.reference }),
        ...(paymentData.notes && { notes: paymentData.notes }),
      };
      
      console.log("Payment payload before submission:", payload);
      return paymentAPI.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Payment recorded successfully",
        description: "The payment has been added to the invoice.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Log the invoice ID to verify it's correct
    console.log("Current invoice ID:", invoice.id);
    console.log("Form data before submission:", formData);
    
    if (parseFloat(formData.amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Payment amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }
    
    if (parseFloat(formData.amount) > remainingAmount) {
      toast({
        title: "Amount exceeds balance",
        description: "Payment amount cannot exceed the remaining balance.",
        variant: "destructive",
      });
      return;
    }

    // Validate bank account selection for methods that require one
    if (requiresBankAccount && !formData.bank_account_id) {
      toast({
        title: "Bank account required",
        description: `Please select a bank account for ${selectedPaymentMethod?.name || "this payment method"}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Include the current invoice ID explicitly
    recordPaymentMutation.mutate({
      ...formData,
      invoiceId: invoice.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-semibold">Invoice:</span> {invoice.invoiceNumber}</div>
            <div><span className="font-semibold">Customer:</span> {invoice.customer?.name}</div>
            <div><span className="font-semibold">Total Amount:</span> {netAmount}</div>
            <div><span className="font-semibold">Paid Amount:</span> {paidAmount.toFixed(2)}</div>
            <div className="col-span-2">
              <span className="font-semibold">Balance:</span> 
              <span className="text-red-600 dark:text-red-400 font-semibold ml-1">{remainingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <DecimalInput
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter payment amount"
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Payment Method</Label>
            <RadioGroup
              value={formData.method}
              onValueChange={(value) => setFormData({
                ...formData,
                method: value,
                bank_account_id: undefined // Reset bank account when method changes
              })}
              className="flex flex-wrap gap-4"
            >
              {paymentMethods.map((pm) => {
                const Icon = getPaymentMethodIcon(pm.icon);
                return (
                  <div key={pm.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={pm.value} id={`payment-modal-${pm.value}`} />
                    <Label htmlFor={`payment-modal-${pm.value}`} className="flex items-center cursor-pointer font-normal">
                      <Icon className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                      {pm.name}
                    </Label>
                  </div>
                );
              })}
              {paymentMethods.length === 0 && (
                <p className="text-sm text-muted-foreground">No active payment methods configured.</p>
              )}
            </RadioGroup>
          </div>

          {/* Bank Account Dropdown - Only shown when the selected method requires one */}
          {requiresBankAccount && (
            <div className="space-y-2">
              <Label htmlFor="bank_account">Select Bank Account *</Label>
              <Select
                value={formData.bank_account_id?.toString()}
                onValueChange={(value) => setFormData({ ...formData, bank_account_id: parseInt(value) })}
              >
                <SelectTrigger id="bank_account">
                  <SelectValue placeholder="Choose bank account" />
                </SelectTrigger>
                <SelectContent>
                  {shopBankAccounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id.toString()}>
                      <div className="flex flex-col">
                        <div className="font-medium">{account.account_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {account.bank_name} • {account.account_number} • Balance: ₨{account.current_balance.toLocaleString()}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shopBankAccounts.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No bank accounts available. Please add a bank account first.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              required
            />
          </div>

          {remainingAmount <= 0 && (
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-md border border-green-200 dark:border-green-800">
              <p className="text-green-700 dark:text-green-300 text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                This invoice has been fully paid.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gradient-primary text-white"
              disabled={recordPaymentMutation.isPending || remainingAmount <= 0}
            >
              {recordPaymentMutation.isPending ? "Processing..." : remainingAmount <= 0 ? "Fully Paid" : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

