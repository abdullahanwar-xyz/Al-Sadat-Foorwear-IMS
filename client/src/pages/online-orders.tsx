import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { SourceCombobox } from "@/components/ui/source-combobox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/utils/currency";
import {
  Truck,
  Check,
  ChevronsUpDown,
  Plus,
  Minus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  productAPI,
  customerAPI,
  bankAccountAPI,
  paymentMethodAPI,
  onlineOrderAPI,
  type Product,
  type ProductColorRate,
  type ProductSize,
  type Invoice,
  type CreateOnlineOrderPayload,
} from "@/service/api";
import { PrintInvoice } from "@/components/invoices/print-invoice";
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

// Pure order-placement form - mirrors Record Sale exactly, right down to
// the post-submit confirmation card. Viewing/managing placed orders
// (status changes, history, delete) all lives on Online Invoices instead -
// the same split Record Sale has with the main Invoices page.
export default function OnlineOrders() {
  const [source, setSource] = useState("instagram");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("500");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productId, setProductId] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [color, setColor] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");

  const [lastOrder, setLastOrder] = useState<Invoice | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Guards against a duplicate submission the same way Record Sale does.
  const submitInFlightRef = useRef(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    refetchOnWindowFocus: "always",
    refetchInterval: 30000,
  });

  const { data: customers, isLoading: customersLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => customerAPI.getAll(),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
  });

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.value === paymentMethod);
  const requiresBankAccount = selectedPaymentMethod?.requiresBankAccount ?? false;

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

  const selectedProduct: Product | undefined = products?.find((p) => p.id.toString() === productId);
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

  const itemsTotal = cart.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const deliveryChargeNum = parseFloat(deliveryCharge) || 0;
  const orderTotal = itemsTotal + deliveryChargeNum;

  const orderMutation = useMutation({
    mutationFn: (payload: CreateOnlineOrderPayload) => onlineOrderAPI.create(payload),
  });

  const resetPicker = () => {
    setProductId("");
    setColor("");
    setSizeId("");
    setQuantity("1");
  };

  const handleSelectProduct = (product: Product) => {
    setProductId(product.id.toString());
    setProductOpen(false);
    const validColorRates = (product.colorRates || []).filter((cr) => cr.color && cr.color.trim() !== "");
    setColor(validColorRates.length === 1 ? validColorRates[0].color : "");
    setSizeId("");
    setQuantity("1");
  };

  const handleSelectColor = (value: string) => {
    setColor(value);
    setSizeId("");
    setQuantity("1");
  };

  const handleSelectSize = (value: string) => {
    setSizeId(value);
    setQuantity("1");
  };

  const adjustQuantity = (delta: number) => {
    const next = qtyNum + delta;
    if (next < 1) return;
    if (availableQty > 0 && next > availableQty) return;
    setQuantity(next.toString());
  };

  const handleAddToCart = () => {
    if (!productId || !selectedColorRate || !selectedSize) {
      toast({ title: "Incomplete selection", description: "Choose a product, color, and size.", variant: "destructive" });
      return;
    }
    if (qtyNum <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be at least 1.", variant: "destructive" });
      return;
    }
    if (qtyExceedsStock) {
      toast({ title: "Insufficient stock", description: `Only ${availableQty} available for this size.`, variant: "destructive" });
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

  const handleRemoveFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const resetForNextOrder = () => {
    setLastOrder(null);
    setLastOrderTotal(0);
    setCart([]);
    resetPicker();
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setDeliveryCharge("500");
    setSource("instagram");
    setPaymentMethod("cash");
    setBankAccountId("");
    setAdvanceAmount("");
  };

  // Resolve (or create) the customer to attach to this order. Phone is the
  // unique identifier - a matching phone reuses that customer record
  // instead of creating a duplicate (same convention as Record Sale).
  const resolveCustomerId = async (trimmedName: string, trimmedPhone: string): Promise<number> => {
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
      phone: trimmedPhone,
      address: deliveryAddress.trim(),
    });
    refetchCustomers();
    return created.id;
  };

  // Prefill (but don't lock) the delivery address from an existing
  // customer's address on file, the moment a phone match is typed.
  useEffect(() => {
    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone || deliveryAddress) return;
    const existing = customers?.find((c) => c.phone === trimmedPhone);
    if (existing?.address) setDeliveryAddress(existing.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone, customers]);

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
      await submitOrder();
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const submitOrder = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedAddress = deliveryAddress.trim();

    if (!trimmedName) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    if (!trimmedPhone) {
      toast({ title: "Phone number required", description: "Needed to reach the customer about this order.", variant: "destructive" });
      return;
    }
    if (!trimmedAddress) {
      toast({ title: "Delivery address required", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "No items", description: "Add at least one item to the order.", variant: "destructive" });
      return;
    }
    if (requiresBankAccount && !bankAccountId) {
      toast({ title: "Bank account required", description: `Please select a bank account for ${selectedPaymentMethod?.name || "this payment method"}.`, variant: "destructive" });
      return;
    }

    let customerId: number;
    try {
      customerId = await resolveCustomerId(trimmedName, trimmedPhone);
    } catch {
      toast({ title: "Customer error", description: "Failed to save customer details. Please try again.", variant: "destructive" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const advance = parseFloat(advanceAmount) || 0;

    const payload: CreateOnlineOrderPayload = {
      invoice: {
        customerId,
        date: today,
        grossAmount: orderTotal,
        discount: 0,
        taxAmount: 0,
        netAmount: orderTotal,
      },
      items: cart.map((item) => ({
        productColorRateId: item.productColorRateId,
        itemName: item.productName,
        quantity: item.quantity,
        size: item.size,
        rate: item.rate,
      })),
      source,
      deliveryAddress: trimmedAddress,
      deliveryCharge: deliveryChargeNum,
      ...(advance > 0
        ? {
            payment: {
              amount: advance,
              method: paymentMethod,
              paymentDate: today,
              ...(requiresBankAccount && bankAccountId ? { bank_account_id: parseInt(bankAccountId, 10) } : {}),
            },
          }
        : {}),
    };

    let createdOrder: Invoice;
    try {
      createdOrder = await orderMutation.mutateAsync(payload);
    } catch (error: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const message = error?.response?.data?.message || "Failed to place order. Please try again.";
      toast({ title: "Order failed", description: message, variant: "destructive" });
      return;
    }

    toast({
      title: "Order placed",
      description: `${createdOrder.invoiceNumber} — ${formatPKR(orderTotal)}`,
    });

    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/online-orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    setLastOrder(createdOrder);
    setLastOrderTotal(orderTotal);
    setCart([]);
  };

  const isSubmitting = orderMutation.isPending;
  const pageLoading = productsLoading || customersLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-poppins font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center">
          <Truck className="h-6 w-6 mr-2" />
          Online Orders
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Place an order from Instagram, TikTok, WhatsApp, Shopify or another channel — advance now, balance on delivery
        </p>
      </div>

      {!pageLoading && lastOrder && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center text-green-700 dark:text-green-400">
              <Truck className="h-6 w-6 mr-2" />
              <span className="font-poppins font-semibold text-lg">Order placed</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div><span className="font-semibold">Order #:</span> {lastOrder.invoiceNumber}</div>
              <div><span className="font-semibold">Source:</span> <span className="capitalize">{lastOrder.onlineOrder?.source}</span></div>
              {lastOrder.customer?.name && (
                <div><span className="font-semibold">Customer:</span> {lastOrder.customer.name}</div>
              )}
              <div><span className="font-semibold">Advance Paid:</span> {formatPKR((lastOrder.payments || []).reduce((s, p) => s + parseFloat(p.amount.toString()), 0))}</div>
              <div className="col-span-2"><span className="font-semibold">Delivery Address:</span> {lastOrder.onlineOrder?.deliveryAddress}</div>
              <div className="col-span-2">
                <span className="font-semibold">Total:</span> {formatPKR(lastOrderTotal)}
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
                  {(lastOrder.items || []).map((item) => (
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
              <Button className="gradient-primary text-white" onClick={resetForNextOrder}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Place Another Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!pageLoading && !lastOrder && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-poppins">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <SourceCombobox value={source} onChange={setSource} />
              </div>
              <div className="space-y-2">
                <Label>Delivery Charge</Label>
                <DecimalInput value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Required" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="Required"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Delivery Address</Label>
                <Textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Required — full delivery address for this order"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Item picker */}
          <Card>
            <CardHeader>
              <CardTitle className="font-poppins">Add Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Product</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={productOpen} className="w-full justify-between">
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
                          <CommandItem key={product.id} value={product.name} onSelect={() => handleSelectProduct(product)}>
                            <Check className={cn("mr-2 h-4 w-4", productId === product.id.toString() ? "opacity-100" : "opacity-0")} />
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

              {colorRates.length > 1 && (
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select value={color} onValueChange={handleSelectColor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colorRates.map((cr) => (
                        <SelectItem key={cr.id} value={cr.color}>{cr.color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              {selectedSize && (
                <>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => adjustQuantity(-1)} disabled={qtyNum <= 1}>
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
                      <Button type="button" variant="outline" size="icon" onClick={() => adjustQuantity(1)} disabled={availableQty === 0 || qtyNum >= availableQty}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {qtyExceedsStock && (
                      <p className="text-sm text-red-600 dark:text-red-400">Only {availableQty} available for this size.</p>
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
                <Button type="button" onClick={handleAddToCart} disabled={!selectedSize || qtyExceedsStock || availableQty === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Order
                </Button>
              </div>
            </CardContent>
          </Card>

          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-poppins">Order Items</CardTitle>
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
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFromCart(item.key)} className="text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <div className="text-right space-y-1">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Items Subtotal: {formatPKR(itemsTotal)}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Delivery Charge: {formatPKR(deliveryChargeNum)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Order Total</div>
                    <div className="font-bold text-xl">{formatPKR(orderTotal)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="font-poppins">Advance Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Advance Amount (optional — need not cover the full total)</Label>
                <DecimalInput value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="0" />
              </div>

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
                        <RadioGroupItem value={pm.value} id={`oo-${pm.value}`} />
                        <Label htmlFor={`oo-${pm.value}`} className="flex items-center cursor-pointer font-normal">
                          <Icon className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                          {pm.name}
                        </Label>
                      </div>
                    );
                  })}
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
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForNextOrder} disabled={isSubmitting}>
                  Clear Order
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="gradient-primary text-white"
                  disabled={isSubmitting || cart.length === 0}
                >
                  {isSubmitting ? "Placing order..." : `Place Order${cart.length > 0 ? ` (${formatPKR(orderTotal)})` : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {lastOrder && (
        <PrintInvoice
          invoice={lastOrder}
          open={printModalOpen}
          onOpenChange={setPrintModalOpen}
        />
      )}
    </div>
  );
}
