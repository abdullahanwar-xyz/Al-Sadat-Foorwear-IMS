import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bankAccountAPI, type BankAccount } from "@/service/api";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface EditBankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount;
}

export function EditBankAccountModal({ open, onOpenChange, account }: EditBankAccountModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    account_name: account.account_name,
    account_number: account.account_number || "",
    bank_name: account.bank_name || "",
    branch: account.branch || "",
    ifsc_code: account.ifsc_code || "",
    description: account.description || "",
    status: account.status,
  });

  useEffect(() => {
    setFormData({
      account_name: account.account_name,
      account_number: account.account_number || "",
      bank_name: account.bank_name || "",
      branch: account.branch || "",
      ifsc_code: account.ifsc_code || "",
      description: account.description || "",
      status: account.status,
    });
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      bankAccountAPI.update(account.account_id, {
        account_name: data.account_name,
        account_number: data.account_number || undefined,
        bank_name: data.bank_name || undefined,
        branch: data.branch || undefined,
        ifsc_code: data.ifsc_code || undefined,
        description: data.description || undefined,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({
        title: "Success",
        description: "Bank account updated successfully!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update bank account",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bank Account</DialogTitle>
          <DialogDescription>
            Update bank account information
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
                required
              />
            </div>

            {/* Status */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="status">Active Status</Label>
              <Switch
                id="status"
                checked={formData.status === 1}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, status: checked ? 1 : 0 })
                }
              />
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
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
