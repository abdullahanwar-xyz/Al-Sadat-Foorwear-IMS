import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { formatPKR } from "@/utils/currency";
import { computeInvoiceBreakdown } from "@/utils/returns";
import type { Invoice } from "@/service/api";

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
}

// Screen-only detail view (as opposed to the 80mm print receipt) showing
// the invoice's current picture: active items only, a chronological History
// of every return/exchange event ever performed on it, and a clear
// Original/Refunded/Additional Paid/Net amount summary - so staff don't
// have to infer the current state from the original total plus a note.
// This invoice's id/number never change no matter how many of these events
// happen to it, so this is always the complete, current story.
export function InvoiceDetailDialog({ invoice, onOpenChange }: InvoiceDetailDialogProps) {
  if (!invoice) return null;

  const breakdown = computeInvoiceBreakdown(invoice.items, invoice.returns, invoice.payments, invoice.netAmount);

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Invoice {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
            <div>
              <div>{invoice.customer?.name || "Unknown"}{invoice.customer?.phone ? ` · ${invoice.customer.phone}` : ""}</div>
              <div>{format(new Date(invoice.createdAt), "MMM dd, yyyy, h:mm a")}</div>
            </div>
            <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
              {invoice.status}
            </Badge>
          </div>

          {/* Items - remaining (non-returned, non-exchanged-out) quantity only */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.remainingItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-slate-500 dark:text-slate-400">
                        All items on this invoice were returned or exchanged
                      </TableCell>
                    </TableRow>
                  ) : (
                    breakdown.remainingItems.map((item: any, index: number) => {
                      const colorPart = item.color && item.color !== "Standard" ? `${item.color}, ` : "";
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {item.itemName || "Item"}
                            {item.size ? <span className="text-slate-500 dark:text-slate-400 text-xs"> ({colorPart}Size {item.size})</span> : null}
                          </TableCell>
                          <TableCell className="text-right">{item.remainingQuantity}</TableCell>
                          <TableCell className="text-right">{formatPKR(item.rate)}</TableCell>
                          <TableCell className="text-right">{formatPKR(item.remainingAmount)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* History - every return/exchange event, chronological */}
          {breakdown.history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">History</h3>
              <div className="space-y-2">
                {breakdown.history.map((event, index) => (
                  <div key={index} className="border border-orange-200 dark:border-orange-900 rounded-lg p-3 text-sm">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {format(new Date(event.date), "MMM dd, yyyy, h:mm a")}
                    </div>
                    <div>{event.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amount Summary */}
          <div className="border-t pt-4">
            {breakdown.hasHistory ? (
              <div className="space-y-1.5 max-w-xs ml-auto">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Original Amount</span>
                  <span>{formatPKR(breakdown.originalAmount)}</span>
                </div>
                {breakdown.totalRefunded > 0 && (
                  <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                    <span>Total Refunded</span>
                    <span>-{formatPKR(breakdown.totalRefunded)}</span>
                  </div>
                )}
                {breakdown.totalAdditionalPaid > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Total Additional Paid</span>
                    <span>+{formatPKR(breakdown.totalAdditionalPaid)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1.5">
                  <span>Net Amount</span>
                  <span>{formatPKR(breakdown.netAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between font-bold text-base max-w-xs ml-auto">
                <span>Total</span>
                <span>{formatPKR(invoice.netAmount)}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
