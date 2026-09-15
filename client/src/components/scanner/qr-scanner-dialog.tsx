import { useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

// Reusable camera/QR scan dialog. Also supports scanning from an uploaded
// image (built into Html5QrcodeScanner) - useful on devices without a
// camera, and while no physical scanner is set up yet.
export function QrScannerDialog({
  open,
  onOpenChange,
  onScanSuccess,
  title = "Scan QR Code",
}: QrScannerDialogProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!open) return;

    // The Dialog portals its content in; the #qr-scanner-region div isn't
    // guaranteed to exist in the DOM on the same tick this effect runs, so
    // defer construction until after the DOM has actually settled.
    let scanner: Html5QrcodeScanner | null = null;
    const timer = setTimeout(() => {
      if (!document.getElementById(SCANNER_ELEMENT_ID)) return;

      scanner = new Html5QrcodeScanner(
        SCANNER_ELEMENT_ID,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [
            Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            Html5QrcodeScanType.SCAN_TYPE_FILE,
          ],
        },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          scanner?.clear().catch(() => {});
          onOpenChange(false);
        },
        () => {
          // Fires continuously while no code is visible - ignore.
        }
      );
    }, 50);

    return () => {
      clearTimeout(timer);
      scanner?.clear().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div id={SCANNER_ELEMENT_ID} />
      </DialogContent>
    </Dialog>
  );
}
