import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/utils/currency";
import {
  ShoppingCart,
  Check,
  ChevronsUpDown,
  Plus,
  Minus,
  Printer,
  RotateCcw,
  CircleAlert,
  CircleCheck,
  Trash2,
  QrCode,
} from "lucide-react";
import {
  productAPI,
  productSizeAPI,
  customerAPI,
  bankAccountAPI,
  paymentMethodAPI,
  saleAPI,
  type Product,
  type ProductColorRate,
  type ProductSize,
  type Invoice,
  type CreateSalePayload,
} from "@/service/api";
import { PrintInvoice } from "@/components/invoices/print-invoice";
import { QrScannerDialog } from "@/components/scanner/qr-scanner-dialog";
import { getPaymentMethodIcon } from "@/lib/payment-method-icons";

interface CartItem {
  key: string;
  productColorRateId: number;
  productName: string;
  color: string;
  sizeId: string;
  size: number;
  quantity: number;
  rate: number;
}

function stockBadgeClasses(quantity: number) {
  if (quantity === 0) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
  if (quantity <= 10) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
  return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
}

function stockDotClasses(quantity: number) {
  if (quantity === 0) return "bg-red-500";
  if (quantity <= 10) return "bg-yellow-500";
  return "bg-green-500";
}

export default function RecordSale() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);

  // Picker fields for the item currently being staged
  const [productId, setProductId] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [color, setColor] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);

  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Invoice | null>(null);
  const [lastSaleTotal, setLastSaleTotal] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Guards against a duplicate submission (rapid double-click, double-tap,
  // Enter held down) creating two identical invoices. A ref is used instead
  // of state because it updates synchronously, immediately on the first
  // call - relying on isSubmitting/disabled alone leaves a window between
  // the click and the next render where a second click can still slip
  // through.
  const submitInFlightRef = useRef(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Stock-sensitive, so this stays reasonably fresh: refetch on window
  // focus and poll every 30s while the tab is visible. This only updates
  // the derived stock numbers shown in the picker (see availableQty etc.
  // below) - it never touches the cart, customer fields, or payment
  // method, since none of those are derived from this query.
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    // The global QueryClient sets staleTime: Infinity, under which plain
    // `true` here would never actually refetch (it only refetches stale
    // data) - 'always' forces it regardless of staleness.
    refetchOnWindowFocus: "always",
    refetchInterval: 30000,
  });

  const {
    data: customers,
    isLoading: customersLoading,
    isError: customersError,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => customerAPI.getAll(),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
  });

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.value === paymentMethod);
  const requiresBankAccount = selectedPaymentMethod?.requiresBankAccount ?? false;

  // Once the active methods load, make sure the current selection is still
  // a valid one (falls back to the first active method - e.g. if an admin
  // deactivates whatever was selected by default).
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.some((pm) => pm.value === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].value);
    }
  }, [paymentMethods, paymentMethod]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["shop-bank-accounts"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: requiresBankAccount,
  });

  const selectedProduct: Product | undefined = products?.find(
    (p) => p.id.toString() === productId
  );
  const colorRates: ProductColorRate[] = (selectedProduct?.colorRates || []).filter(
    (cr) => cr.color && cr.color.trim() !== ""
  );
  const selectedColorRate = colorRates.find((cr) => cr.color === color);
  const sizes: ProductSize[] = selectedColorRate?.sizes || [];
  const selectedSize = sizes.find((s) => s.id.toString() === sizeId);

  const availableQty = selectedSize?.quantity ?? 0;
  const rate = selectedColorRate?.rate ?? 0;
  const qtyNum = parseInt(quantity, 10) || 0;
  const lineTotal = qtyNum * rate;

  const qtyExceedsStock = !!selectedSize && qtyNum > availableQty;

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.rate, 0);

  const saleMutation = useMutation({
    mutationFn: (payload: CreateSalePayload) => saleAPI.create(payload),
  });

  const handleSelectProduct = (product: Product) => {
    setProductId(product.id.toString());
    setProductOpen(false);
    const validColorRates = (product.colorRates || []).filter(
      (cr) => cr.color && cr.color.trim() !== ""
    );
    setColor(validColorRates.length === 1 ? validColorRates[0].color : "");
    setSizeId("");
    setQuantity("1");
    setStockErrorMessage(null);
  };

  const handleSelectColor = (value: string) => {
    setColor(value);
    setSizeId("");
    setQuantity("1");
    setStockErrorMessage(null);
  };

  const handleSelectSize = (value: string) => {
    setSizeId(value);
    setQuantity("1");
    setStockErrorMessage(null);
  };

  const adjustQuantity = (delta: number) => {
    const next = qtyNum + delta;
    if (next < 1) return;
    if (availableQty > 0 && next > availableQty) return;
    setQuantity(next.toString());
  };

  const resetPicker = () => {
    setProductId("");
    setColor("");
    setSizeId("");
    setQuantity("1");
  };

  const handleAddToCart = () => {
    setStockErrorMessage(null);

    if (!productId) {
      toast({ title: "Product required", description: "Please select a product.", variant: "destructive" });
      return;
    }
    if (colorRates.length > 1 && !color) {
      toast({ title: "Color required", description: "Please select a color.", variant: "destructive" });
      return;
    }
    if (!selectedColorRate) {
      toast({ title: "Color required", description: "Please select a valid color for this product.", variant: "destructive" });
      return;
    }
    if (!selectedSize) {
      toast({ title: "Size required", description: "Please select a size.", variant: "destructive" });
      return;
    }
    if (qtyNum <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be at least 1.", variant: "destructive" });
      return;
    }
    if (qtyExceedsStock) {
      toast({
        title: "Insufficient stock",
        description: `Only ${availableQty} available for this size.`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        key: `${selectedColorRate.id}-${selectedSize.id}-${Date.now()}`,
        productColorRateId: selectedColorRate.id,
        productName: selectedProduct?.name || "Item",
        color: selectedColorRate.color,
        sizeId: selectedSize.id.toString(),
        size: selectedSize.size,
        quantity: qtyNum,
        rate,
      },
    ]);

    resetPicker();
  };

  const handleScanSuccess = async (decodedText: string) => {
    setStockErrorMessage(null);
    try {
      const item = await productSizeAPI.lookup(decodedText.trim());
      if (item.quantity <= 0) {
        setStockErrorMessage(`${item.productName} (${item.color}, size ${item.size}) is out of stock.`);
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          key: `${item.productColorRateId}-${item.productSizeId}-${Date.now()}`,
          productColorRateId: item.productColorRateId,
          productName: item.productName,
          color: item.color,
          sizeId: item.productSizeId.toString(),
          size: item.size,
          quantity: 1,
          rate: item.rate,
        },
      ]);
      toast({
        title: "Item added",
        description: `${item.productName} (${item.color}, size ${item.size}) added to sale.`,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || "No item found for this code.";
      setStockErrorMessage(message);
    }
  };

  const handleRemoveFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const resetForNextSale = () => {
    setLastSale(null);
    setLastSaleTotal(0);
    setCart([]);
    resetPicker();
    setPaymentMethod("cash");
    setBankAccountId("");
    setStockErrorMessage(null);
    setCustomerName("");
    setCustomerPhone("");
  };

  // Resolve (or create) the customer to attach to this sale. Phone number is
  // the unique identifier - a matching phone reuses that customer record
  // instead of creating a duplicate. If the name typed this time differs
  // from what's on file, that's treated as the customer's name having
  // changed (not a mistake to silently ignore), so the record is updated to
  // match rather than keeping the old name.
  const resolveCustomerId = async (trimmedName: string): Promise<number> => {
    const trimmedPhone = customerPhone.trim();
    if (trimmedPhone) {
      const existing = customers?.find((c) => c.phone === trimmedPhone);
      if (existing) {
        if (existing.name !== trimmedName) {
          await customerAPI.update(existing.id, { name: trimmedName });
          refetchCustomers();
        }
        return existing.id;
      }
    }

    const created = await customerAPI.create({
      name: trimmedName,
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
    });
    return created.id;
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
      await submitSale();
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const submitSale = async () => {
    setStockErrorMessage(null);

    const trimmedName = customerName.trim();
    if (cart.length === 0) {
      toast({ title: "No items", description: "Add at least one item to the sale.", variant: "destructive" });
      return;
    }
    if (requiresBankAccount && !bankAccountId) {
      toast({ title: "Bank account required", description: `Please select a bank account for ${selectedPaymentMethod?.name || "this payment method"}.`, variant: "destructive" });
      return;
    }

    let customerId: number;
    try {
      if (trimmedName) {
        customerId = await resolveCustomerId(trimmedName);
      } else {
        // No name typed and no dropdown pick - the invoice still needs a
        // real customerId (Invoice.customerId isn't nullable), so this
        // falls back to the shop's existing Walk-in Customer record. That's
        // purely a data-integrity detail: unlike an explicit "Walk-in
        // Customer" dropdown pick, this name is never shown on the receipt
        // or confirmation screen (handled right after the sale is created,
        // below).
        const walkIn = customers?.find((c) => c.name === "Walk-in Customer");
        if (!walkIn) {
          throw new Error("Walk-in Customer record not found");
        }
        customerId = walkIn.id;
      }
    } catch (error) {
      toast({ title: "Customer error", description: "Failed to save customer details. Please try again.", variant: "destructive" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const payload: CreateSalePayload = {
      invoice: {
        customerId,
        date: today,
        grossAmount: cartTotal,
        discount: 0,
        taxAmount: 0,
        netAmount: cartTotal,
      },
      items: cart.map((item) => ({
        productColorRateId: item.productColorRateId,
        itemName: item.productName,
        quantity: item.quantity,
        size: item.size,
        rate: item.rate,
      })),
      // Recorded in the same transaction as the sale itself - either both
      // the sale and the payment succeed, or neither does. There's no
      // longer a "stock deducted but payment not saved" state to recover
      // from.
      payment: {
        amount: cartTotal,
        method: paymentMethod,
        paymentDate: today,
        ...(requiresBankAccount && bankAccountId ? { bank_account_id: parseInt(bankAccountId, 10) } : {}),
      },
    };

    let createdInvoice: Invoice;
    try {
      createdInvoice = await saleMutation.mutateAsync(payload);
    } catch (error: any) {
      // Stock may have changed since the page loaded; refresh so the UI reflects reality.
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const message = error?.response?.data?.message || "Failed to record sale. Please try again.";
      setStockErrorMessage(message);
      toast({ title: "Sale failed", description: message, variant: "destructive" });
      return;
    }

    toast({
      title: "Sale recorded",
      description: `${createdInvoice.invoiceNumber} — ${formatPKR(cartTotal)}`,
    });

    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    // No name was typed or picked, so the Walk-in Customer fallback above
    // is purely internal plumbing - don't surface it on the confirmation
    // screen or printed receipt, both of which read from this same object.
    if (!trimmedName && createdInvoice.customer) {
      createdInvoice = { ...createdInvoice, customer: { ...createdInvoice.customer, name: "" } };
    }
    setLastSale(createdInvoice);
    setLastSaleTotal(cartTotal);
    setCart([]);
  };

  const isSubmitting = saleMutation.isPending;

  const pageLoading = productsLoading || customersLoading;
  // Only block the page when there's no cached products data to fall back
  // on (a genuine initial-load failure). Once products has loaded once, a
  // failed background refetch (window focus / periodic poll) must not hide
  // an in-progress sale - the cart, customer fields, and payment method
  // must stay exactly as the salesman left them.
  const pageError = (productsError && !products) || customersError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-poppins font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center">
          <ShoppingCart className="h-6 w-6 mr-2" />
          Record Sale
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Add items to a sale, then check out
        </p>
      </div>

      {pageLoading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      )}

      {!pageLoading && pageError && (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-red-600 dark:text-red-400">
              Failed to load products or customers.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                refetchProducts();
                refetchCustomers();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!pageLoading && !pageError && lastSale && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center text-green-700 dark:text-green-400">
              <CircleCheck className="h-6 w-6 mr-2" />
              <span className="font-poppins font-semibold text-lg">
                Sale recorded
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div><span className="font-semibold">Invoice:</span> {lastSale.invoiceNumber}</div>
              {lastSale.customer?.name && (
                <div><span className="font-semibold">Customer:</span> {lastSale.customer.name}</div>
              )}
              <div className="col-span-2">
                <span className="font-semibold">Total:</span> {formatPKR(lastSaleTotal)}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lastSale.items || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatPKR(item.rate)}</TableCell>
                      <TableCell className="text-right">{formatPKR(item.quantity * item.rate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintModalOpen(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button className="gradient-primary text-white" onClick={resetForNextSale}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Record Another Sale
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!pageLoading && !pageError && !lastSale && (
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="font-poppins">Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Select
                  onValueChange={(value) => {
                    if (value === "walk-in") setCustomerName("Walk-in Customer");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Quick select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional - leave blank for a walk-in sale"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="Optional"
                />
              </div>
            </CardContent>
          </Card>

          {/* Item picker */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="font-poppins">Add Item</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScannerOpen(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Product */}
              <div className="space-y-2">
                <Label>Product</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between"
                    >
                      {selectedProduct ? selectedProduct.name : "Search products..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup className="max-h-[240px] overflow-y-auto">
                        {products?.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={() => handleSelectProduct(product)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                productId === product.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(product.colorRates || []).filter((cr) => cr.color).length} color(s)
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Color - only shown when the product has more than one */}
              {colorRates.length > 1 && (
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select value={color} onValueChange={handleSelectColor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
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
              )}

              {/* Size */}
              {selectedColorRate && (
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select value={sizeId} onValueChange={handleSelectSize} disabled={sizes.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={sizes.length === 0 ? "No sizes configured" : "Select size..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()} disabled={s.quantity === 0}>
                          <span className="flex items-center justify-between w-full gap-3">
                            <span>{s.size}</span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", stockBadgeClasses(s.quantity))}>
                              {s.quantity === 0 ? "Out of stock" : `${s.quantity} in stock`}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Live stock + quantity */}
              {selectedSize && (
                <>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", stockDotClasses(availableQty))} />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {availableQty === 0 ? "Out of stock" : `${availableQty} available`}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustQuantity(-1)}
                        disabled={qtyNum <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={availableQty || undefined}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-20 text-center"
                        disabled={availableQty === 0}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustQuantity(1)}
                        disabled={availableQty === 0 || qtyNum >= availableQty}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {qtyExceedsStock && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Only {availableQty} available for this size.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Rate</div>
                      <div className="font-medium">{formatPKR(rate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Line Total</div>
                      <div className="font-semibold text-lg">{formatPKR(lineTotal)}</div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!selectedSize || qtyExceedsStock || availableQty === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Sale
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cart */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins">Sale Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.color}</TableCell>
                          <TableCell>{item.size}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatPKR(item.rate)}</TableCell>
                          <TableCell className="text-right">{formatPKR(item.quantity * item.rate)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFromCart(item.key)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Grand Total</div>
                    <div className="font-bold text-xl">{formatPKR(cartTotal)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stockErrorMessage && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300 flex items-start">
              <CircleAlert className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              {stockErrorMessage}
            </div>
          )}

          {/* Payment + checkout */}
          <Card>
            <CardHeader>
              <CardTitle className="font-poppins">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <Label>Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => {
                    setPaymentMethod(value);
                    setBankAccountId("");
                  }}
                  className="flex flex-wrap gap-4"
                >
                  {paymentMethods.map((pm) => {
                    const Icon = getPaymentMethodIcon(pm.icon);
                    return (
                      <div key={pm.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={pm.value} id={`sale-${pm.value}`} />
                        <Label htmlFor={`sale-${pm.value}`} className="flex items-center cursor-pointer font-normal">
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

              {requiresBankAccount && (
                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id.toString()}>
                          {account.account_name} • {account.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {bankAccounts.length === 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      No bank accounts available. Please add a bank account first.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForNextSale}
                  disabled={isSubmitting}
                >
                  Clear Sale
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="gradient-primary text-white"
                  disabled={isSubmitting || cart.length === 0}
                >
                  {isSubmitting ? "Recording sale..." : `Record Sale${cart.length > 0 ? ` (${formatPKR(cartTotal)})` : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {lastSale && (
        <PrintInvoice
          invoice={lastSale}
          open={printModalOpen}
          onOpenChange={setPrintModalOpen}
        />
      )}

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanSuccess={handleScanSuccess}
        title="Scan Item to Add"
      />
    </div>
  );
}
