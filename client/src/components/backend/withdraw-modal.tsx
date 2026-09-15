import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bankAccountAPI, paymentMethodAPI, type BankAccount } from "@/service/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

export function WithdrawModal({ open, onOpenChange, account }: WithdrawModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    amount: "",
    payment_method: "",
    description: "",
    reference_number: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodAPI.getAll(),
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      bankAccountAPI.withdraw(account!.account_id, {
        amount: parseFloat(data.amount),
        payment_method: data.payment_method,
        description: data.description || undefined,
        reference_number: data.reference_number || undefined,
        transaction_date: data.transaction_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow-summary"] });
      toast({
        title: "Success",
        description: "Withdrawal recorded successfully!",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to record withdrawal",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      amount: "",
      payment_method: "",
      description: "",
      reference_number: "",
      transaction_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      toast({
        title: "Error",
        description: "No account selected",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!formData.payment_method) {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    // Check if withdrawal amount exceeds balance
    if (account && parseFloat(formData.amount) > account.current_balance) {
      toast({
        title: "Warning",
        description: "Withdrawal amount exceeds current balance. This will result in a negative balance.",
        variant: "destructive",
      });
    }

    withdrawMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            {account && `Withdraw funds from ${account.account_name}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <Label htmlFor="amount">
              Amount (PKR) <span className="text-red-500">*</span>
            </Label>
            <DecimalInput
              id="amount"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.00"
              required
            />
            {account && (
              <p className="text-sm text-muted-foreground mt-1">
                Current Balance: ₨{account.current_balance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="payment_method">
              Payment Method <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) =>
                setFormData({ ...formData, payment_method: value })
              }
              required
            >
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem
                    key={method.id}
                    value={method.name}
                  >
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Date */}
          <div>
            <Label htmlFor="transaction_date">Transaction Date</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) =>
                setFormData({ ...formData, transaction_date: e.target.value })
              }
            />
          </div>

          {/* Reference Number */}
          <div>
            <Label htmlFor="reference_number">Reference Number</Label>
            <Input
              id="reference_number"
              value={formData.reference_number}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
              placeholder="Cheque/Transaction ID"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Add notes about this withdrawal"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={withdrawMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={withdrawMutation.isPending}
              variant="destructive"
            >
              {withdrawMutation.isPending ? "Processing..." : "Withdraw Funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
