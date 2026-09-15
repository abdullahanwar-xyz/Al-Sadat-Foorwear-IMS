import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bankAccountAPI } from "@/service/api";
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

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferModal({ open, onOpenChange }: TransferModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    description: "",
    reference_number: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  // Fetch active bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", { status: 1 }],
    queryFn: () => bankAccountAPI.getAll({ status: 1 }),
  });

  const transferMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      bankAccountAPI.transfer({
        from_account_id: parseInt(data.from_account_id),
        to_account_id: parseInt(data.to_account_id),
        amount: parseFloat(data.amount),
        description: data.description || undefined,
        reference_number: data.reference_number || undefined,
        transaction_date: data.transaction_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow-summary"] });
      toast({
        title: "Success",
        description: "Transfer completed successfully!",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to complete transfer",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      from_account_id: "",
      to_account_id: "",
      amount: "",
      description: "",
      reference_number: "",
      transaction_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.from_account_id || !formData.to_account_id) {
      toast({
        title: "Error",
        description: "Please select both accounts",
        variant: "destructive",
      });
      return;
    }

    if (formData.from_account_id === formData.to_account_id) {
      toast({
        title: "Error",
        description: "Cannot transfer to the same account",
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

    // Check if transfer amount exceeds balance
    const fromAccount = bankAccounts.find(
      (acc) => acc.account_id === parseInt(formData.from_account_id)
    );
    if (fromAccount && parseFloat(formData.amount) > fromAccount.current_balance) {
      toast({
        title: "Warning",
        description: "Transfer amount exceeds current balance. This will result in a negative balance.",
        variant: "destructive",
      });
    }

    transferMutation.mutate(formData);
  };

  // Get available destination accounts (excluding source)
  const availableDestinations = bankAccounts.filter(
    (acc) => acc.account_id.toString() !== formData.from_account_id
  );

  // Get selected from account
  const fromAccount = bankAccounts.find(
    (acc) => acc.account_id.toString() === formData.from_account_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Transfer money between bank or cash accounts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* From Account */}
          <div>
            <Label htmlFor="from_account_id">
              From Account <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.from_account_id}
              onValueChange={(value) =>
                setFormData({ ...formData, from_account_id: value })
              }
              required
            >
              <SelectTrigger id="from_account_id">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((account) => (
                  <SelectItem
                    key={account.account_id}
                    value={account.account_id.toString()}
                  >
                    {account.account_name} (₨{account.current_balance.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromAccount && (
              <p className="text-sm text-muted-foreground mt-1">
                Current Balance: ₨{fromAccount.current_balance.toLocaleString()}
              </p>
            )}
          </div>

          {/* To Account */}
          <div>
            <Label htmlFor="to_account_id">
              To Account <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.to_account_id}
              onValueChange={(value) =>
                setFormData({ ...formData, to_account_id: value })
              }
              required
              disabled={!formData.from_account_id}
            >
              <SelectTrigger id="to_account_id">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {availableDestinations.map((account) => (
                  <SelectItem
                    key={account.account_id}
                    value={account.account_id.toString()}
                  >
                    {account.account_name} (₨{account.current_balance.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              placeholder="Transaction ID"
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
              placeholder="Add notes about this transfer"
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
              disabled={transferMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
