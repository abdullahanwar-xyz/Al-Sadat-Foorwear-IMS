import type { Invoice, OnlineOrder, OnlineOrderSource } from "@/service/api";

// Shared between the Online Orders (management) and Online Invoices
// (history) pages, so the badge/label/suggestion logic can't drift apart
// between the two views of the same underlying data.

// Source is free text now (OnlineOrderSource, a manageable list), not a
// fixed enum - the four original channels still get their own color for
// quick scanning, any custom source falls back to a neutral badge.
export function sourceBadgeClasses(source?: OnlineOrderSource | null) {
  switch ((source || "").toLowerCase()) {
    case "instagram":
      return "border-pink-300 bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300";
    case "tiktok":
      return "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    case "whatsapp":
      return "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "shopify":
      return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function fulfillmentBadge(status: OnlineOrder["fulfillmentStatus"]) {
  switch (status) {
    case "pending":
      return { variant: "secondary" as const, label: "Pending", className: "" };
    case "shipped":
      return { variant: "outline" as const, label: "Shipped", className: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    case "delivered":
      return { variant: "default" as const, label: "Delivered", className: "" };
    case "cancelled":
      return { variant: "destructive" as const, label: "Cancelled", className: "" };
  }
}

// The clear-at-a-glance resolution state for a cancelled order - null for
// any order that isn't cancelled.
export function resolutionLabel(order: OnlineOrder): string | null {
  if (order.fulfillmentStatus !== "cancelled") return null;
  const wasShipped = !!order.shippedAt;
  if (!wasShipped) {
    return order.refundedAt ? "Cancelled — Fully resolved" : "Cancelled (pre-dispatch) — Refund pending";
  }
  if (!order.stockReturnedAt) return "Cancelled (failed delivery) — Awaiting stock return";
  if (!order.refundedAt) return "Cancelled (failed delivery) — Stock returned, refund pending";
  return "Cancelled — Fully resolved";
}

export function totalPaid(invoice: Invoice): number {
  return (invoice.payments || []).reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
}

// Pre-dispatch: full amount paid (delivery charge included - nothing was
// spent). Post-dispatch: amount paid minus the delivery charge (spent,
// non-refundable once dispatched). Just a pre-fill - staff can edit before
// confirming.
export function suggestedRefund(invoice: Invoice): number {
  const order = invoice.onlineOrder!;
  const paid = totalPaid(invoice);
  const suggestion = order.shippedAt ? paid - order.deliveryCharge : paid;
  return Math.max(0, Math.round(suggestion * 100) / 100);
}
