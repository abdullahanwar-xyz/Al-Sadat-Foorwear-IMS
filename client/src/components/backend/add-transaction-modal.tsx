import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supplierTransactionAPI,
  supplierAPI,
  bankAccountAPI,
  productAPI,
  type Product,
} from "@/service/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Landmark, Plus, Trash2 } from "lucide-react";
import { formatPKR } from "@/utils/currency";

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DraftItem {
  key: string;
  isInventoryItem: boolean;
  // Inventory item fields
  productColorRateId?: number;
  productName?: string;
  color?: string;
  size?: number;
  // Non-inventory ("Other Item") fields
  description?: string;
  // Shared
  quantity: number;
  unitCost: number;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState("");
  const [type, setType] = useState<"purchase" | "payment">("purchase");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [bankAccountId, setBankAccountId] = useState<number | undefined>(undefined);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);

  // Item picker staging fields
  const [itemType, setItemType] = useState<"inventory" | "other">("inventory");
  const [productId, setProductId] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [otherDescription, setOtherDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => supplierAPI.getAll(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    enabled: type === "purchase",
  });

  const { data: shopBankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", "shop"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: paymentMethod === "bank",
  });

  const selectedProduct: Product | undefined = products.find((p) => p.id.toString() === productId);
  const colorRates = (selectedProduct?.colorRates || []).filter((cr) => cr.color && cr.color.trim() !== "");
  const selectedColorRate = colorRates.find((cr) => cr.color === color);

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const resetPicker = () => {
    setItemType("inventory");
    setProductId("");
    setColor("");
    setSize("");
    setOtherDescription("");
    setQuantity("1");
    setUnitCost("");
  };

  const resetForm = () => {
    setSupplierId("");
    setType("purchase");
    setItems([]);
    setAmountPaid("");
    setDescription("");
    setPaymentMethod("cash");
    setBankAccountId(undefined);
    setReferenceNumber("");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    resetPicker();
  };

  const handleSelectProduct = (value: string) => {
    setProductId(value);
    const product = products.find((p) => p.id.toString() === value);
    const validColorRates = (product?.colorRates || []).filter((cr) => cr.color && cr.color.trim() !== "");
    const nextColor = validColorRates.length === 1 ? validColorRates[0].color : "";
    setColor(nextColor);
    setUnitCost(
      validColorRates.length === 1 ? validColorRates[0].rate.toString() : ""
    );
    setSize("");
    setQuantity("1");
  };

  const handleSelectColor = (value: string) => {
    setColor(value);
    const cr = colorRates.find((c) => c.color === value);
    setUnitCost(cr ? cr.rate.toString() : "");
    setSize("");
    setQuantity("1");
  };

  const handleAddItem = () => {
    const qtyNum = parseInt(quantity, 10);
    const costNum = parseFloat(unitCost);

    if (!qtyNum || qtyNum <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be at least 1.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(costNum) || costNum < 0) {
      toast({ title: "Invalid unit cost", description: "Please enter a valid unit cost.", variant: "destructive" });
      return;
    }

    if (itemType === "inventory") {
      if (!selectedProduct || !selectedColorRate) {
        toast({ title: "Product required", description: "Please select a product and color.", variant: "destructive" });
        return;
      }
      const sizeNum = parseFloat(size);
      if (Number.isNaN(sizeNum) || sizeNum <= 0) {
        toast({ title: "Size required", description: "Please enter a valid size.", variant: "destructive" });
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          key: `${selectedColorRate.id}-${sizeNum}-${Date.now()}`,
          isInventoryItem: true,
          productColorRateId: selectedColorRate.id,
          productName: selectedProduct.name,
          color: selectedColorRate.color,
          size: sizeNum,
          quantity: qtyNum,
          unitCost: costNum,
        },
      ]);
    } else {
      const trimmedDescription = otherDescription.trim();
      if (!trimmedDescription) {
        toast({ title: "Description required", description: "Please describe the item (e.g. \"Leather - 10 sq ft\").", variant: "destructive" });
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          key: `other-${Date.now()}`,
          isInventoryItem: false,
          description: trimmedDescription,
          quantity: qtyNum,
          unitCost: costNum,
        },
      ]);
    }
    resetPicker();
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const paidAmount = parseFloat(amountPaid) || 0;
      return supplierTransactionAPI.create({
        supplier_id: parseInt(supplierId),
        type,
        items: type === "purchase"
          ? items.map((i) =>
              i.isInventoryItem
                ? {
                    is_inventory_item: true,
                    product_color_rate_id: i.productColorRateId,
                    size: i.size,
                    quantity: i.quantity,
                    unit_cost: i.unitCost,
                  }
                : {
                    is_inventory_item: false,
                    description: i.description,
                    quantity: i.quantity,
                    unit_cost: i.unitCost,
                  }
            )
          : undefined,
        amount_paid: paidAmount,
        description: description || undefined,
        payment_method: paidAmount > 0 ? paymentMethod : undefined,
        ...(paidAmount > 0 && paymentMethod === "bank" && bankAccountId && { bank_account_id: bankAccountId }),
        reference_number: referenceNumber || undefined,
        transaction_date: transactionDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["backend-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Transaction recorded successfully!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to record transaction",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId || !transactionDate) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const paidAmount = parseFloat(amountPaid) || 0;

    if (type === "purchase") {
      if (items.length === 0) {
        toast({ title: "Items required", description: "Add at least one received item.", variant: "destructive" });
        return;
      }
      if (paidAmount > itemsTotal + 0.01) {
        toast({ title: "Error", description: "Amount paid cannot exceed the total value of goods received.", variant: "destructive" });
        return;
      }
    } else {
      if (paidAmount <= 0) {
        toast({ title: "Error", description: "Payment amount must be greater than 0.", variant: "destructive" });
        return;
      }
    }

    if (paidAmount > 0) {
      if (paymentMethod === "bank" && !bankAccountId) {
        toast({ title: "Error", description: "Please select a bank account for bank payment.", variant: "destructive" });
        return;
      }
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
          <DialogDescription>
            Record a supplier purchase (goods received) or a payment against an existing balance
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <Label htmlFor="supplier_id">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId} required>
                <SelectTrigger id="supplier_id">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.supplier_id} value={supplier.supplier_id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Type */}
            <div>
              <Label htmlFor="type">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(value: "purchase" | "payment") => {
                  setType(value);
                  setItems([]);
                  setAmountPaid("");
                }}
                required
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase (Goods Received)</SelectItem>
                  <SelectItem value="payment">Payment (Settle Balance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Date */}
            <div>
              <Label htmlFor="transaction_date">
                Transaction Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="transaction_date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>

            {/* Reference Number */}
            <div>
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Invoice #, Receipt #, etc."
              />
            </div>
          </div>

          {type === "purchase" && (
            <div className="space-y-3 rounded-lg border p-4">
              <Label>Received Items <span className="text-red-500">*</span></Label>

              <RadioGroup
                value={itemType}
                onValueChange={(value: "inventory" | "other") => {
                  setItemType(value);
                  setProductId("");
                  setColor("");
                  setSize("");
                  setOtherDescription("");
                  setQuantity("1");
                  setUnitCost("");
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="inventory" id="item-type-inventory" />
                  <Label htmlFor="item-type-inventory" className="cursor-pointer font-normal">
                    Inventory Item
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="item-type-other" />
                  <Label htmlFor="item-type-other" className="cursor-pointer font-normal">
                    Other Item
                  </Label>
                </div>
              </RadioGroup>

              {itemType === "inventory" ? (
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Product</Label>
                    <Select value={productId} onValueChange={handleSelectProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <Select value={color} onValueChange={handleSelectColor} disabled={!productId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Color" />
                      </SelectTrigger>
                      <SelectContent>
                        {colorRates.map((cr) => (
                          <SelectItem key={cr.id} value={cr.color}>
                            {cr.color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Size</Label>
                    <DecimalInput
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="Size"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={otherDescription}
                      onChange={(e) => setOtherDescription(e.target.value)}
                      placeholder="e.g. Leather - 10 sq ft"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Unit Cost (₨)</Label>
                  <DecimalInput
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-3 flex justify-end">
                  <Button type="button" onClick={handleAddItem} variant="secondary">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>

              {items.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.key}>
                          {item.isInventoryItem ? (
                            <>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.color}</TableCell>
                              <TableCell>{item.size}</TableCell>
                            </>
                          ) : (
                            <TableCell colSpan={3}>
                              <Badge variant="secondary" className="mr-2">Other</Badge>
                              {item.description}
                            </TableCell>
                          )}
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatPKR(item.unitCost)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPKR(item.quantity * item.unitCost)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.key)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end p-3 border-t">
                    <span className="font-semibold">Total: {formatPKR(itemsTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Amount Paid */}
            <div>
              <Label htmlFor="amount_paid">
                {type === "purchase" ? "Amount Paid Now (₨)" : "Payment Amount (₨)"}
                {type === "payment" && <span className="text-red-500"> *</span>}
              </Label>
              <DecimalInput
                id="amount_paid"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                required={type === "payment"}
              />
              {type === "purchase" && items.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Leave 0 to record the full amount as owed. Total: {formatPKR(itemsTotal)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            {(parseFloat(amountPaid) || 0) > 0 && (
              <div>
                <Label>Payment Method <span className="text-red-500">*</span></Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value: "cash" | "bank") => {
                    setPaymentMethod(value);
                    setBankAccountId(undefined);
                  }}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash-trans" />
                    <Label htmlFor="cash-trans" className="flex items-center gap-2 cursor-pointer">
                      <Wallet className="h-4 w-4 text-green-600" />
                      Cash
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bank" id="bank-trans" />
                    <Label htmlFor="bank-trans" className="flex items-center gap-2 cursor-pointer">
                      <Landmark className="h-4 w-4 text-blue-600" />
                      Bank
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Bank Account Selection (Conditional) */}
          {(parseFloat(amountPaid) || 0) > 0 && paymentMethod === "bank" && (
            <div>
              <Label htmlFor="bank_account_id">
                Bank Account <span className="text-red-500">*</span>
              </Label>
              {shopBankAccounts.length > 0 ? (
                <Select
                  value={bankAccountId?.toString()}
                  onValueChange={(value) => setBankAccountId(parseInt(value))}
                >
                  <SelectTrigger id="bank_account_id">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopBankAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name} ({formatPKR(account.current_balance)})
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

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter transaction details..."
              rows={3}
            />
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
              {createMutation.isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
