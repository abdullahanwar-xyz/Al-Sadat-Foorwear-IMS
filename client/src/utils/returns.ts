// Shared helpers for deriving an invoice's return/exchange state - all
// computed at render time from InvoiceItem.returnedQuantity plus the
// Return/ReturnItem/Refund/Payment records already fetched with the
// invoice. Nothing here is stored text: in the single-invoice model, a
// return or exchange always acts on the same invoice (it never creates a
// new one), so the invoice can accumulate any number of these events over
// its lifetime and this always reflects the current, correct picture.
import { formatPKR } from "@/utils/currency";

export interface ReturnableInvoiceItem {
  itemName?: string;
  color?: string;
  size?: number | string;
  quantity: number | string;
  returnedQuantity?: number | string;
}

export interface ReturnSummary {
  totalQuantity: number;
  totalReturned: number;
  remainingQuantity: number;
  hasAnyReturn: boolean;
  isFullyReturned: boolean;
}

// Used by the Invoices list badge ("Returned" / "Partially Returned") -
// covers both plain returns and exchanged-out items the same way, since
// both just increment returnedQuantity.
export function getReturnSummary(items: ReturnableInvoiceItem[] | undefined | null): ReturnSummary {
  let totalQuantity = 0;
  let totalReturned = 0;

  for (const item of items || []) {
    totalQuantity += parseFloat(item.quantity?.toString() || "0") || 0;
    totalReturned += parseFloat(item.returnedQuantity?.toString() || "0") || 0;
  }

  const remainingQuantity = totalQuantity - totalReturned;

  return {
    totalQuantity,
    totalReturned,
    remainingQuantity,
    hasAnyReturn: totalReturned > 0,
    isFullyReturned: totalReturned > 0 && remainingQuantity <= 0,
  };
}

// --- Full breakdown (Items / History / Amount Summary) ---
// Used by the invoice detail view and the print receipt - the one and only
// rendering path now, since an invoice is never "superseded" anymore.

export interface InvoiceItemLike extends ReturnableInvoiceItem {
  id: number;
  rate: number | string;
}

export interface ExchangeItemLike {
  quantity: number | string;
  newInvoiceItemId?: number | null;
}

export interface ReturnItemLike {
  invoiceItemId: number;
  returnedQuantity: number | string;
  refundAmount: number | string;
  isExchange?: boolean;
  // One returned item can be exchanged for several different new items.
  exchangeItems?: ExchangeItemLike[];
}

export interface RefundLike {
  amount: number | string;
  method: string;
  refundDate: string;
}

export interface PaymentLike {
  amount: number | string;
  method: string;
  returnId?: number | null;
}

export interface ReturnLike {
  id: number;
  type?: string;
  date: string;
  createdAt?: string;
  items?: ReturnItemLike[];
  refunds?: RefundLike[];
}

export interface RemainingItem extends InvoiceItemLike {
  remainingQuantity: number;
  remainingAmount: number;
}

export interface HistoryEvent {
  returnId: number;
  date: string;
  description: string;
  refundAmount: number;
  additionalPaymentAmount: number;
}

export interface InvoiceBreakdown {
  remainingItems: RemainingItem[];
  history: HistoryEvent[];
  originalAmount: number;
  totalRefunded: number;
  totalAdditionalPaid: number;
  netAmount: number;
  hasHistory: boolean;
}

function describeLine(item: InvoiceItemLike | undefined, quantity: number | string | null | undefined): string {
  if (!item) return `Item x${quantity ?? "?"}`;
  const colorPart = item.color && item.color !== "Standard" ? `${item.color}, ` : "";
  return `${item.itemName || "Item"} (${colorPart}Size ${item.size}) x${quantity}`;
}

export function computeInvoiceBreakdown(
  items: InvoiceItemLike[] | undefined | null,
  returns: ReturnLike[] | undefined | null,
  payments: PaymentLike[] | undefined | null,
  originalAmount: number | string
): InvoiceBreakdown {
  const allItems = items || [];
  const allPayments = payments || [];
  const sortedReturns = [...(returns || [])].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.date).getTime();
    const dateB = new Date(b.createdAt || b.date).getTime();
    return dateA - dateB || a.id - b.id;
  });

  const remainingItems: RemainingItem[] = allItems
    .map((item) => {
      const quantity = parseFloat(item.quantity?.toString() || "0") || 0;
      const returned = parseFloat(item.returnedQuantity?.toString() || "0") || 0;
      const rate = parseFloat(item.rate?.toString() || "0") || 0;
      const remainingQuantity = quantity - returned;
      return { ...item, remainingQuantity, remainingAmount: remainingQuantity * rate };
    })
    .filter((item) => item.remainingQuantity > 0);

  const history: HistoryEvent[] = sortedReturns.map((ret) => {
    const plainLines: string[] = [];
    const exchangeRemovedLines: string[] = [];
    const exchangeAddedLines: string[] = [];

    for (const ri of ret.items || []) {
      const oldItem = allItems.find((i) => i.id === ri.invoiceItemId);
      const removedDesc = describeLine(oldItem, ri.returnedQuantity);

      if (ri.isExchange) {
        exchangeRemovedLines.push(removedDesc);
        for (const ei of ri.exchangeItems || []) {
          const newItem = ei.newInvoiceItemId != null ? allItems.find((i) => i.id === ei.newInvoiceItemId) : undefined;
          exchangeAddedLines.push(describeLine(newItem, ei.quantity));
        }
      } else {
        plainLines.push(removedDesc);
      }
    }

    const refundAmount = (ret.refunds || []).reduce((sum, r) => sum + (parseFloat(r.amount?.toString() || "0") || 0), 0);
    const additionalPaymentAmount = allPayments
      .filter((p) => p.returnId === ret.id)
      .reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || "0") || 0), 0);

    const descriptionParts: string[] = [];
    if (plainLines.length > 0) descriptionParts.push(`Returned: ${plainLines.join(", ")}`);
    if (exchangeRemovedLines.length > 0) {
      descriptionParts.push(`Exchanged: removed ${exchangeRemovedLines.join(", ")}, added ${exchangeAddedLines.join(", ")}`);
    }

    const moneyParts: string[] = [];
    if (refundAmount > 0.01) moneyParts.push(`${formatPKR(refundAmount)} refunded`);
    if (additionalPaymentAmount > 0.01) moneyParts.push(`${formatPKR(additionalPaymentAmount)} additional payment`);

    const description = descriptionParts.join("; ") + (moneyParts.length > 0 ? `, ${moneyParts.join(", ")}` : "");

    return {
      returnId: ret.id,
      date: ret.createdAt || ret.date,
      description,
      refundAmount,
      additionalPaymentAmount,
    };
  });

  const original = parseFloat(originalAmount?.toString() || "0") || 0;
  const totalRefunded = history.reduce((sum, h) => sum + h.refundAmount, 0);
  const totalAdditionalPaid = history.reduce((sum, h) => sum + h.additionalPaymentAmount, 0);

  return {
    remainingItems,
    history,
    originalAmount: original,
    totalRefunded,
    totalAdditionalPaid,
    netAmount: original - totalRefunded + totalAdditionalPaid,
    hasHistory: history.length > 0,
  };
}
