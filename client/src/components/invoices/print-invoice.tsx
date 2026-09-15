import { useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { computeInvoiceBreakdown } from "@/utils/returns";

interface PrintInvoiceProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 80mm thermal receipt layout (narrow, like a mart receipt) - replaces the
// old A4-style table. The on-screen preview renders at the same physical
// width (mm units) so what you see is what prints.
export function PrintInvoice({ invoice, open, onOpenChange }: PrintInvoiceProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${invoice.invoiceNumber}`,
    onAfterPrint: () => onOpenChange(false),
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
        }
      }
    `,
  });

  useEffect(() => {
    if (open && printRef.current) {
      // Auto-print when modal opens
      setTimeout(() => {
        handlePrint();
      }, 500);
    }
  }, [open, handlePrint]);

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  // Single-invoice model: a return or exchange always acts on this same
  // invoice, so this is the one and only rendering path - there's no
  // separate "superseded" invoice state to special-case anymore.
  const breakdown = computeInvoiceBreakdown(items, invoice.returns, invoice.payments, invoice.netAmount);
  const displayItems = breakdown.remainingItems;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center">
            <Printer className="mr-2 h-5 w-5" />
            Print Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-2">
          <Button onClick={handlePrint} className="gradient-primary text-white" id="print-button">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        {/* Printable Content - true 80mm width so the preview matches the print */}
        <div className="flex justify-center bg-slate-100 dark:bg-slate-800 print:bg-white rounded-lg border py-4">
          <div
            ref={printRef}
            className="print-container"
            style={{ width: "80mm", padding: "3mm", boxSizing: "border-box", fontFamily: "monospace", fontSize: "11px", color: "#000", background: "#fff" }}
          >
            <div style={{ textAlign: "center", marginBottom: "2mm" }}>
              <div style={{ fontSize: "13px", fontWeight: "bold" }}>Al Sadat Footwear</div>
              <div style={{ fontSize: "10px" }}>Sales Receipt</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "1mm 0" }} />

            <div>Bill #: {invoice.invoiceNumber}</div>
            <div>Date: {format(new Date(invoice.createdAt), "dd/MM/yyyy, h:mm a")}</div>
            <div>
              Status: <strong>{invoice.status.toUpperCase()}</strong>
            </div>
            {invoice.customer?.name && (
              <div>
                Customer: {invoice.customer.name}
                {invoice.customer?.phone ? ` (${invoice.customer.phone})` : ""}
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "1mm 0" }} />

            {displayItems.length > 0 ? (
              displayItems.map((item: any, index: number) => {
                const colorPart = item.color && item.color !== "Standard" ? `${item.color}, ` : "";
                return (
                  <div key={index} style={{ marginBottom: "1.5mm" }}>
                    <div>{item.itemName || "Item"}{item.size ? ` (${colorPart}Size ${item.size})` : ""}</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{item.remainingQuantity} x {(parseFloat(item.rate) || 0).toFixed(2)}</span>
                      <span>{item.remainingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: "center" }}>All items on this invoice were returned or exchanged</div>
            )}

            {breakdown.history.length > 0 && (
              <>
                <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />
                <div style={{ fontWeight: "bold", fontSize: "10px", marginBottom: "1mm" }}>HISTORY</div>
                {breakdown.history.map((event, index) => (
                  <div key={index} style={{ marginBottom: "1mm", fontSize: "9px" }}>
                    <div style={{ color: "#555" }}>{format(new Date(event.date), "dd/MM/yyyy, h:mm a")}</div>
                    <div>{event.description}</div>
                  </div>
                ))}
              </>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />

            {breakdown.hasHistory ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Original Amount</span>
                  <span>{breakdown.originalAmount.toFixed(2)}</span>
                </div>
                {breakdown.totalRefunded > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Refunded</span>
                    <span>-{breakdown.totalRefunded.toFixed(2)}</span>
                  </div>
                )}
                {breakdown.totalAdditionalPaid > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Additional Paid</span>
                    <span>+{breakdown.totalAdditionalPaid.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px", borderTop: "1px solid #000", marginTop: "1mm", paddingTop: "1mm" }}>
                  <span>NET AMOUNT</span>
                  <span>{breakdown.netAmount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px" }}>
                <span>TOTAL</span>
                <span>{breakdown.originalAmount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "1mm" }}>
              <QRCodeSVG value={invoice.id.toString()} size={70} />
              <div style={{ fontSize: "9px", marginTop: "1mm" }}>Scan to look up this invoice</div>
            </div>

            <div style={{ textAlign: "center", fontSize: "10px", marginTop: "2mm" }}>Thank you for shopping with us!</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
