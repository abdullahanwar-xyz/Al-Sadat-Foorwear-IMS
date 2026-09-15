import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatPKR } from "@/utils/currency";
import { RotateCcw, CircleAlert, QrCode, X } from "lucide-react";
import {
  productAPI,
  productSizeAPI,
  bankAccountAPI,
  paymentMethodAPI,
  returnAPI,
  type Invoice,
  type Product,
  type CreateReturnItemPayload,
  type CreateReturnResponse,
} from "@/service/api";
import { QrScannerDialog } from "@/components/scanner/qr-scanner-dialog";
import { getPaymentMethodIcon } from "@/lib/payment-method-icons";

interface ReturnExchangeDialogProps {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: CreateReturnResponse) => void;
}

// One new item added to an exchange row's running list - mirrors Record
// Sale's CartItem, since this is the same "picker + Add button + list"
// pattern, just scoped to one returned item's exchange instead of the whole
// sale.
interface ExchangeNewItemDraft {
  key: string;
  productColorRateId: number;
  productName: string;
  color: string;
  sizeId: string;
  size: number;
  quantity: number;
  rate: number;
}

interface DraftRow {
  invoiceItemId: number;
  included: boolean;
  returnQty: string;
  isExchange: boolean;
  // One returned item can be exchanged for several different new items -
  // this is the running list, built up via the picker fields below (or a
  // QR scan) plus an "Add" step, same as Record Sale's cart.
  newItems: ExchangeNewItemDraft[];
  // The picker's current in-progress selection, not yet added to the list.
  pickerProductId: string;
  pickerColor: string;
  pickerSizeId: string;
  pickerQuantity: string;
}

function emptyDraftRow(invoiceItemId: number): DraftRow {
  return {
    invoiceItemId,
    included: false,
    returnQty: "1",
    isExchange: false,
    newItems: [],
    pickerProductId: "",
    pickerColor: "",
    pickerSizeId: "",
    pickerQuantity: "1",
  };
}

export function ReturnExchangeDialog({ invoice, onOpenChange, onSuccess }: ReturnExchangeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Record<number, DraftRow>>({});
  const [settlementMethod, setSettlementMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scanningForItemId, setScanningForItemId] = useState<number | null>(null);

  const open = !!invoice;

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ["/api/returns/invoice", invoice?.id, "summary"],
    queryFn: () => returnAPI.getSummary(invoice!.id),
    enabled: open,
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    enabled: open,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodAPI.getAll(true),
    enabled: open,
  });

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.value === settlementMethod);
  const requiresBankAccount = selectedPaymentMethod?.requiresBankAccount ?? false;

  useEffect(() => {
    if (open && paymentMethods.length > 0 && !paymentMethods.some((pm) => pm.value === settlementMethod)) {
      setSettlementMethod(paymentMethods[0].value);
    }
  }, [open, paymentMethods, settlementMethod]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["shop-bank-accounts"],
    queryFn: () => bankAccountAPI.getShopBankAccounts(),
    enabled: open && requiresBankAccount,
  });

  // Reset local draft state whenever a fresh summary loads for a newly
  // opened invoice.
  useEffect(() => {
    if (!summary) return;
    const initial: Record<number, DraftRow> = {};
    for (const item of summary.items) {
      initial[item.invoiceItemId] = emptyDraftRow(item.invoiceItemId);
    }
    setRows(initial);
    setSettlementMethod("cash");
    setBankAccountId("");
    setSubmitError(null);
  }, [summary]);

  const updateRow = (invoiceItemId: number, patch: Partial<DraftRow>) => {
    setRows((prev) => ({
      ...prev,
      [invoiceItemId]: { ...prev[invoiceItemId], ...patch },
    }));
  };

  // Scanning a product QR in the exchange picker resolves the new
  // product/color/size and appends it straight to that row's new-items
  // list, same as Record Sale's scan-to-cart - no confirmation step, just
  // like a manual Add.
  const handleScanForRow = async (decodedText: string) => {
    const itemId = scanningForItemId;
    setScanningForItemId(null);
    if (!itemId) return;

    try {
      const result = await productSizeAPI.lookup(decodedText.trim());
      if (result.quantity <= 0) {
        toast({
          title: "Out of stock",
          description: `${result.productName} (${result.color}, Size ${result.size}) is out of stock.`,
          variant: "destructive",
        });
        return;
      }
      const currentRow = rows[itemId] || emptyDraftRow(itemId);
      updateRow(itemId, {
        newItems: [
          ...currentRow.newItems,
          {
            key: `${result.productColorRateId}-${result.productSizeId}-${Date.now()}`,
            productColorRateId: result.productColorRateId,
            productName: result.productName,
            color: result.color,
            sizeId: result.productSizeId.toString(),
            size: result.size,
            quantity: 1,
            rate: result.rate,
          },
        ],
      });
      toast({
        title: "Item added",
        description: `${result.productName} (${result.color}, size ${result.size}) added to exchange.`,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || "No item found for this code.";
      toast({ title: "Scan failed", description: message, variant: "destructive" });
    }
  };

  // Per-row derived values: refund amount, the picker's current in-progress
  // selection (product/color/size/rate/stock for whatever isn't added yet),
  // and - for exchanges - the total value of everything already in the
  // row's new-items list and the resulting price difference.
  const computedRows = useMemo(() => {
    if (!summary) return [];

    return summary.items.map((item) => {
      const row = rows[item.invoiceItemId] || emptyDraftRow(item.invoiceItemId);
      const returnQty = parseFloat(row.returnQty) || 0;
      const exceedsReturnable = returnQty > item.returnableQuantity;
      const refundAmount = returnQty * item.rate;

      let pickerColorRates: Product["colorRates"] = [];
      let pickerSizes: Product["colorRates"][number]["sizes"] = [];
      let pickerAvailableQty = 0;
      let pickerQuantityNum = 0;
      let pickerExceedsStock = false;

      if (row.isExchange) {
        const pickerProduct = products?.find((p) => p.id.toString() === row.pickerProductId);
        pickerColorRates = (pickerProduct?.colorRates || []).filter((cr) => cr.color && cr.color.trim() !== "");
        const selectedColorRate = pickerColorRates.find((cr) => cr.color === row.pickerColor);
        pickerSizes = selectedColorRate?.sizes || [];
        const selectedSize = pickerSizes.find((s) => s.id.toString() === row.pickerSizeId);
        pickerAvailableQty = selectedSize?.quantity ?? 0;
        pickerQuantityNum = parseFloat(row.pickerQuantity) || 0;
        pickerExceedsStock = !!selectedSize && pickerQuantityNum > pickerAvailableQty;
      }

      const totalNewValue = row.newItems.reduce((sum, ni) => sum + ni.quantity * ni.rate, 0);
      const priceDifference = row.isExchange ? totalNewValue - refundAmount : -refundAmount;

      return {
        item,
        row,
        returnQty,
        exceedsReturnable,
        refundAmount,
        pickerColorRates,
        pickerSizes,
        pickerAvailableQty,
        pickerQuantityNum,
        pickerExceedsStock,
        totalNewValue,
        priceDifference,
      };
    });
  }, [summary, rows, products]);

  const includedRows = computedRows.filter((r) => r.row.included);
  const netDifference = includedRows.reduce((sum, r) => sum + r.priceDifference, 0);
  const needsSettlement = Math.abs(netDifference) > 0.01;

  const hasBlockingError = includedRows.some((r) => {
    if (r.returnQty <= 0 || r.exceedsReturnable) return true;
    if (r.row.isExchange && r.row.newItems.length === 0) return true;
    return false;
  });

  // Validates the picker's current selection and, if valid, appends it to
  // that row's new-items list and resets the picker - same shape as Record
  // Sale's "Add to Cart".
  const handleAddNewItem = (invoiceItemId: number) => {
    const computed = computedRows.find((r) => r.item.invoiceItemId === invoiceItemId);
    if (!computed) return;
    const { row, pickerColorRates, pickerSizes, pickerQuantityNum, pickerExceedsStock } = computed;

    if (!row.pickerProductId) {
      toast({ title: "Product required", description: "Please select a product.", variant: "destructive" });
      return;
    }
    if (pickerColorRates.length > 1 && !row.pickerColor) {
      toast({ title: "Color required", description: "Please select a color.", variant: "destructive" });
      return;
    }
    const selectedColorRate = pickerColorRates.find((cr) => cr.color === row.pickerColor) || pickerColorRates[0];
    if (!selectedColorRate) {
      toast({ title: "Color required", description: "Please select a valid color for this product.", variant: "destructive" });
      return;
    }
    const selectedSize = pickerSizes.find((s) => s.id.toString() === row.pickerSizeId);
    if (!selectedSize) {
      toast({ title: "Size required", description: "Please select a size.", variant: "destructive" });
      return;
    }
    if (pickerQuantityNum <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be at least 1.", variant: "destructive" });
      return;
    }
    if (pickerExceedsStock) {
      toast({
        title: "Insufficient stock",
        description: `Only ${selectedSize.quantity} available for this size.`,
        variant: "destructive",
      });
      return;
    }

    const product = products?.find((p) => p.id.toString() === row.pickerProductId);

    updateRow(invoiceItemId, {
      newItems: [
        ...row.newItems,
        {
          key: `${selectedColorRate.id}-${selectedSize.id}-${Date.now()}`,
          productColorRateId: selectedColorRate.id,
          productName: product?.name || "Item",
          color: selectedColorRate.color,
          sizeId: selectedSize.id.toString(),
          size: selectedSize.size,
          quantity: pickerQuantityNum,
          rate: selectedColorRate.rate,
        },
      ],
      pickerProductId: "",
      pickerColor: "",
      pickerSizeId: "",
      pickerQuantity: "1",
    });
  };

  const handleRemoveNewItem = (invoiceItemId: number, key: string) => {
    const currentRow = rows[invoiceItemId];
    if (!currentRow) return;
    updateRow(invoiceItemId, { newItems: currentRow.newItems.filter((ni) => ni.key !== key) });
  };

  const canSubmit =
    includedRows.length > 0 &&
    !hasBlockingError &&
    (!needsSettlement || !requiresBankAccount || !!bankAccountId);

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async () => {
    if (!invoice || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    const items: CreateReturnItemPayload[] = includedRows.map((r) => {
      const payload: CreateReturnItemPayload = {
        invoiceItemId: r.item.invoiceItemId,
        returnedQuantity: r.returnQty,
      };
      if (r.row.isExchange) {
        payload.isExchange = true;
        payload.newItems = r.row.newItems.map((ni) => ({
          newProductColorRateId: ni.productColorRateId,
          newSize: ni.size,
          newQuantity: ni.quantity,
          newRate: ni.rate,
        }));
      }
      return payload;
    });

    try {
      const result = await returnAPI.create({
        invoiceId: invoice.id,
        items,
        settlement: needsSettlement
          ? {
              method: settlementMethod,
              ...(requiresBankAccount && bankAccountId ? { bank_account_id: parseInt(bankAccountId, 10) } : {}),
            }
          : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      const direction = result.netDifference < 0 ? "Refund" : result.netDifference > 0 ? "Additional payment" : null;
      const settlementText = direction ? `${direction}: ${formatPKR(Math.abs(result.netDifference))}` : "Settled with no balance due.";
      toast({
        title: result.return.type === "exchange" ? "Exchange processed" : "Return processed",
        description: settlementText,
      });

      onSuccess(result);
      handleClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to process return/exchange. Please try again.";
      setSubmitError(message);
      toast({ title: "Return failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center">
            <RotateCcw className="mr-2 h-5 w-5" />
            Return / Exchange - {invoice?.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        {summaryLoading && <div className="py-8 text-center text-slate-500">Loading invoice items...</div>}

        {!summaryLoading && summaryError && (
          <div className="py-8 text-center text-red-600 dark:text-red-400">
            Failed to load this invoice's items. Please close and try again.
          </div>
        )}

        {!summaryLoading && summary && (
          <div className="space-y-5">
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Returnable</TableHead>
                    <TableHead>Return Qty</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedRows.map(({ item, row, exceedsReturnable, refundAmount, pickerColorRates, pickerSizes, pickerAvailableQty, pickerExceedsStock, totalNewValue }) => (
                    <Fragment key={item.invoiceItemId}>
                      <TableRow>
                        <TableCell>
                          {/* Every row here already has returnableQuantity > 0 -
                              the summary endpoint excludes anything fully
                              returned/exchanged-out before it ever reaches
                              this picker. */}
                          <Checkbox
                            checked={row.included}
                            onCheckedChange={(checked) => updateRow(item.invoiceItemId, { included: !!checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {item.color !== "Standard" ? `${item.color} - ` : ""}Size {item.size} - {formatPKR(item.rate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.returnableQuantity} of {item.quantity}
                          {item.returnedQuantity > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.returnedQuantity} already returned</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={item.returnableQuantity || undefined}
                            value={row.returnQty}
                            disabled={!row.included}
                            onChange={(e) => updateRow(item.invoiceItemId, { returnQty: e.target.value })}
                            className="w-20"
                          />
                          {row.included && exceedsReturnable && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">Max {item.returnableQuantity}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <RadioGroup
                            value={row.isExchange ? "exchange" : "return"}
                            onValueChange={(v) => updateRow(item.invoiceItemId, { isExchange: v === "exchange" })}
                            className="flex gap-3"
                          >
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="return" id={`return-${item.invoiceItemId}`} disabled={!row.included} />
                              <Label htmlFor={`return-${item.invoiceItemId}`} className="font-normal cursor-pointer text-xs">Return</Label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="exchange" id={`exchange-${item.invoiceItemId}`} disabled={!row.included} />
                              <Label htmlFor={`exchange-${item.invoiceItemId}`} className="font-normal cursor-pointer text-xs">Exchange</Label>
                            </div>
                          </RadioGroup>
                        </TableCell>
                        <TableCell className="text-right">{formatPKR(refundAmount)}</TableCell>
                      </TableRow>

                      {row.included && row.isExchange && (
                        <TableRow>
                          <TableCell></TableCell>
                          <TableCell colSpan={5}>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-3">
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setScanningForItemId(item.invoiceItemId)}
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Scan
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">New Product</Label>
                                  <Select
                                    value={row.pickerProductId}
                                    onValueChange={(v) => updateRow(item.invoiceItemId, { pickerProductId: v, pickerColor: "", pickerSizeId: "" })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select product..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products?.map((p) => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {pickerColorRates.length > 1 && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Color</Label>
                                    <Select
                                      value={row.pickerColor}
                                      onValueChange={(v) => updateRow(item.invoiceItemId, { pickerColor: v, pickerSizeId: "" })}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select color..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {pickerColorRates.map((cr) => (
                                          <SelectItem key={cr.id} value={cr.color}>{cr.color}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {(pickerColorRates.length <= 1 ? pickerColorRates.length === 1 : row.pickerColor) && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">New Size</Label>
                                    <Select
                                      value={row.pickerSizeId}
                                      onValueChange={(v) => updateRow(item.invoiceItemId, { pickerSizeId: v })}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select size..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {pickerSizes.map((s) => (
                                          <SelectItem key={s.id} value={s.id.toString()} disabled={s.quantity === 0}>
                                            {s.size} ({s.quantity === 0 ? "Out of stock" : `${s.quantity} in stock`})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <Label className="text-xs">Quantity</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      value={row.pickerQuantity}
                                      onChange={(e) => updateRow(item.invoiceItemId, { pickerQuantity: e.target.value })}
                                      className="h-9 w-20"
                                    />
                                    <Button type="button" size="sm" className="h-9" onClick={() => handleAddNewItem(item.invoiceItemId)}>
                                      Add
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {row.pickerSizeId && pickerExceedsStock && (
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center">
                                  <CircleAlert className="h-3.5 w-3.5 mr-1" />
                                  Only {pickerAvailableQty} available for the selected size.
                                </p>
                              )}

                              {row.newItems.length > 0 && (
                                <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs">Color</TableHead>
                                        <TableHead className="text-xs">Size</TableHead>
                                        <TableHead className="text-xs">Qty</TableHead>
                                        <TableHead className="text-xs text-right">Rate</TableHead>
                                        <TableHead className="text-xs text-right">Total</TableHead>
                                        <TableHead className="w-8"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {row.newItems.map((ni) => (
                                        <TableRow key={ni.key}>
                                          <TableCell className="text-sm">{ni.productName}</TableCell>
                                          <TableCell className="text-sm">{ni.color}</TableCell>
                                          <TableCell className="text-sm">{ni.size}</TableCell>
                                          <TableCell className="text-sm">{ni.quantity}</TableCell>
                                          <TableCell className="text-sm text-right">{formatPKR(ni.rate)}</TableCell>
                                          <TableCell className="text-sm text-right">{formatPKR(ni.quantity * ni.rate)}</TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              onClick={() => handleRemoveNewItem(item.invoiceItemId, ni.key)}
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow>
                                        <TableCell colSpan={5} className="text-right text-xs font-medium">Total new value</TableCell>
                                        <TableCell className="text-right text-sm font-bold">{formatPKR(totalNewValue)}</TableCell>
                                        <TableCell></TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {netDifference < 0 ? "Refund due to customer" : netDifference > 0 ? "Additional payment due" : "Net difference"}
                </div>
                <div className={`font-bold text-xl ${netDifference < 0 ? "text-red-600 dark:text-red-400" : netDifference > 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                  {formatPKR(Math.abs(netDifference))}
                </div>
              </div>
            </div>

            {needsSettlement && (
              <div className="space-y-3 border-t pt-4">
                <Label>{netDifference < 0 ? "Refund Method" : "Payment Method"}</Label>
                <RadioGroup
                  value={settlementMethod}
                  onValueChange={(v) => {
                    setSettlementMethod(v);
                    setBankAccountId("");
                  }}
                  className="flex flex-wrap gap-4"
                >
                  {paymentMethods.map((pm) => {
                    const Icon = getPaymentMethodIcon(pm.icon);
                    return (
                      <div key={pm.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={pm.value} id={`settlement-${pm.value}`} />
                        <Label htmlFor={`settlement-${pm.value}`} className="flex items-center cursor-pointer font-normal">
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

                {requiresBankAccount && (
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id.toString()}>
                          {account.account_name} - {account.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300 flex items-start">
                <CircleAlert className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="gradient-primary text-white"
              >
                {submitting ? "Processing..." : includedRows.some((r) => r.row.isExchange) ? "Process Return/Exchange" : "Process Return"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <QrScannerDialog
        open={scanningForItemId !== null}
        onOpenChange={(o) => !o && setScanningForItemId(null)}
        onScanSuccess={handleScanForRow}
        title="Scan Item to Exchange For"
      />
    </Dialog>
  );
}
