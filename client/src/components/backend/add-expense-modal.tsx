import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseAPI, bankAccountAPI, paymentMethodAPI, EXPENSE_CATEGORIES } from "@/service/api";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatPKR } from "@/utils/currency";
import { getPaymentMethodIcon } from "@/lib/payment-method-icons";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExpenseModal({ open, onOpenChange }: AddExpenseModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    bank_account_id: undefined as number | undefined,
    reference_number: "",
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
  });

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.value === formData.payment_method);
  const requiresBankAccount = selectedPaymentMethod?.requiresBankAccount ?? false;

  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.some((pm) => pm.value === formData.payment_method)) {
      setFormData((prev) => ({ ...prev, payment_method: paymentMethods[0].value }));
    }
  }, [paymentMethods, formData.payment_method]);

  // Fetch shop bank accounts (only when the selected method needs one)
  const { data: shopBankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", "shop"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: requiresBankAccount,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const methodRequiresBankAccount = paymentMethods.find((pm) => pm.value === data.payment_method)?.requiresBankAccount ?? false;
      return expenseAPI.create({
        category: data.category,
        amount: parseFloat(data.amount),
        description: data.description || undefined,
        expense_date: data.expense_date,
        payment_method: data.payment_method,
        ...(methodRequiresBankAccount && data.bank_account_id && {
          bank_account_id: data.bank_account_id,
        }),
        reference_number: data.reference_number || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
      queryClient.invalidateQueries({ queryKey: ["expense-by-category"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flows"] });
      toast({
        title: "Success",
        description: "Expense created successfully!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "",
      amount: "",
      description: "",
      expense_date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      bank_account_id: undefined,
      reference_number: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category || !formData.amount || !formData.expense_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (requiresBankAccount && !formData.bank_account_id) {
      toast({
        title: "Error",
        description: `Please select a bank account for ${selectedPaymentMethod?.name || "this payment method"}`,
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Record a new business expense with category and details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <Label htmlFor="category">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="amount">
                Amount (₨) <span className="text-red-500">*</span>
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

            {/* Expense Date */}
            <div>
              <Label htmlFor="expense_date">
                Expense Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) =>
                  setFormData({ ...formData, expense_date: e.target.value })
                }
                required
              />
            </div>

            {/* Payment Method */}
            <div className="col-span-2">
              <Label>Payment Method <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={formData.payment_method}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_method: value, bank_account_id: undefined })
                }
                className="flex flex-wrap gap-4 mt-2"
              >
                {paymentMethods.map((pm) => {
                  const Icon = getPaymentMethodIcon(pm.icon);
                  return (
                    <div key={pm.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={pm.value} id={`expense-${pm.value}`} />
                      <Label htmlFor={`expense-${pm.value}`} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
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

            {/* Bank Account Selection (Conditional) */}
            {requiresBankAccount && (
              <div className="col-span-2">
                <Label htmlFor="bank_account_id">
                  Bank Account <span className="text-red-500">*</span>
                </Label>
                {shopBankAccounts.length > 0 ? (
                  <Select
                    value={formData.bank_account_id?.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bank_account_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="bank_account_id">
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopBankAccounts.map((account) => (
                        <SelectItem
                          key={account.account_id}
                          value={account.account_id.toString()}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{account.account_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {account.bank_name} • {account.account_number}
                            </span>
                            <span className="text-xs text-green-600 ml-2">
                              Balance: {formatPKR(account.current_balance)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    No bank accounts available. Please add a bank account first.
                  </p>
                )}
              </div>
            )}

            {/* Reference Number */}
            <div>
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) =>
                  setFormData({ ...formData, reference_number: e.target.value })
                }
                placeholder="Receipt #, Invoice #, etc."
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter expense details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
