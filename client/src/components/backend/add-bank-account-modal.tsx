import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

interface AddBankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBankAccountModal({ open, onOpenChange }: AddBankAccountModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    account_type: "bank" as "bank" | "cash" | "wallet",
    opening_balance: "",
    currency: "PKR",
    branch: "",
    ifsc_code: "",
    description: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      bankAccountAPI.create({
        account_name: data.account_name,
        account_number: data.account_number || undefined,
        bank_name: data.bank_name || undefined,
        account_type: data.account_type,
        opening_balance: parseFloat(data.opening_balance) || 0,
        currency: data.currency,
        branch: data.branch || undefined,
        ifsc_code: data.ifsc_code || undefined,
        description: data.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow-summary"] });
      toast({
        title: "Success",
        description: "Bank account created successfully!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create bank account",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      account_name: "",
      account_number: "",
      bank_name: "",
      account_type: "bank",
      opening_balance: "",
      currency: "PKR",
      branch: "",
      ifsc_code: "",
      description: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.account_name) {
      toast({
        title: "Error",
        description: "Please enter account name",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Bank Account</DialogTitle>
          <DialogDescription>
            Create a new bank account or cash account for tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Account Name */}
            <div className="col-span-2">
              <Label htmlFor="account_name">
                Account Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) =>
                  setFormData({ ...formData, account_name: e.target.value })
                }
                placeholder="e.g., Main Bank Account"
                required
              />
            </div>

            {/* Account Type */}
            <div>
              <Label htmlFor="account_type">
                Account Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.account_type}
                onValueChange={(value: "bank" | "cash" | "wallet") =>
                  setFormData({ ...formData, account_type: value })
                }
              >
                <SelectTrigger id="account_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="cash">Cash Account</SelectItem>
                  <SelectItem value="wallet">Wallet Account (JazzCash, Easypaisa, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Name */}
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
                placeholder="e.g., HBL, MCB, UBL"
              />
            </div>

            {/* Account Number */}
            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                placeholder="1234567890"
              />
            </div>

            {/* Branch */}
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={formData.branch}
                onChange={(e) =>
                  setFormData({ ...formData, branch: e.target.value })
                }
                placeholder="e.g., Main Branch, Gulberg"
              />
            </div>

            {/* IFSC/IBAN Code */}
            <div>
              <Label htmlFor="ifsc_code">IFSC/IBAN Code</Label>
              <Input
                id="ifsc_code"
                value={formData.ifsc_code}
                onChange={(e) =>
                  setFormData({ ...formData, ifsc_code: e.target.value })
                }
                placeholder="PK36ABCD1234567890"
              />
            </div>

            {/* Opening Balance */}
            <div>
              <Label htmlFor="opening_balance">Opening Balance (₨)</Label>
              <DecimalInput
                id="opening_balance"
                value={formData.opening_balance}
                onChange={(e) =>
                  setFormData({ ...formData, opening_balance: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            {/* Currency */}
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                disabled
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
                placeholder="Additional notes about this account..."
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
              {createMutation.isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
