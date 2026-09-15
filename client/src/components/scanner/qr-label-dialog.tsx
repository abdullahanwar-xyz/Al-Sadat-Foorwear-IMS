import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export interface QrLabelItem {
  productSizeId: number;
  productName: string;
  collection: string;
  color: string;
  size: number;
}

interface QrLabelDialogProps {
  item: QrLabelItem | null;
  onOpenChange: (open: boolean) => void;
}

// Placeholder label layout - a standard 2x1 inch size printable on any
// regular printer. Real label dimensions will replace this once the label
// printer arrives.
export function QrLabelDialog({ item, onOpenChange }: QrLabelDialogProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: item ? `QR-${item.productSizeId}` : "QR Label",
    pageStyle: `
      @page {
        size: 2in 1in;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
        }
      }
    `,
  });

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>QR Label Preview</DialogTitle>
        </DialogHeader>

        {item && (
          <>
            <div className="flex justify-center py-2">
              <div
                ref={labelRef}
                className="print-container flex items-center gap-2 border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden"
                style={{ width: "2in", height: "1in", padding: "0.06in", boxSizing: "border-box" }}
              >
                <QRCodeSVG value={item.productSizeId.toString()} size={72} />
                <div style={{ fontSize: "7pt", lineHeight: 1.25 }} className="min-w-0">
                  <div className="font-semibold truncate">{item.productName}</div>
                  <div className="truncate">{item.collection}</div>
                  {item.color !== "Standard" && <div className="truncate">{item.color}</div>}
                  <div>Size: {item.size}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handlePrint} className="gradient-primary text-white">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
