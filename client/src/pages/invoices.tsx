import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useToast } from "../hooks/use-toast";
import { Printer, Trash2, Search, RotateCcw, QrCode, Eye } from "lucide-react";
import { format } from "date-fns";
import { invoiceAPI, type Invoice } from "../service/api";
import { PrintInvoice } from "../components/invoices/print-invoice";
import { ReturnExchangeDialog } from "../components/invoices/return-exchange-dialog";
import { InvoiceDetailDialog } from "../components/invoices/invoice-detail-dialog";
import { QrScannerDialog } from "../components/scanner/qr-scanner-dialog";
import { useAuth } from "@/lib/auth-context";
import { getReturnSummary, computeInvoiceBreakdown } from "@/utils/returns";
import type { CreateReturnResponse } from "@/service/api";

export default function Invoices() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManageInvoices = hasRole(["ShopOwner", "SuperAdmin"]);

  // Fetch invoices. Refetch on window focus so a deletion made by another
  // user (e.g. Admin) is picked up when this tab regains focus - no
  // continuous polling, since invoice history isn't as time-sensitive as
  // stock.
  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: () => invoiceAPI.getAll(),
    // The global QueryClient sets staleTime: Infinity, under which plain
    // `true` here would never actually refetch (it only refetches stale
    // data) - 'always' forces it regardless of staleness.
    refetchOnWindowFocus: "always",
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: number) => invoiceAPI.delete(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice deleted",
        description: "The invoice has been removed successfully.",
      });
    },
    onError: (error: any, invoiceId: number) => {
      console.error("Error deleting invoice:", error);

      // Check if it's a constraint error with associated records
      let errorMessage = "Failed to delete invoice. Please try again.";
      const responseData = error?.response?.data;

      if (responseData?.message) {
        errorMessage = responseData.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      // Check if there are payments associated with this invoice
      if (responseData?.hasPayments) {
        const paymentsCount = responseData.paymentsCount || 0;
        const paymentsList = responseData.payments || [];

        let paymentDetails = `This invoice has ${paymentsCount} payment(s):\n\n`;
        paymentsList.forEach((payment: any, index: number) => {
          paymentDetails += `${index + 1}. Amount: ${payment.amount} (${payment.method.toUpperCase()})\n`;
          paymentDetails += `   Date: ${new Date(payment.date).toLocaleDateString()}\n`;
        });
        paymentDetails += `\nIf you delete this invoice, all payments will be reversed and the amounts will be deducted from the respective bank/cash accounts.`;

        const confirmed = window.confirm(
          `${paymentDetails}\n\nDo you want to proceed with the deletion?`
        );

        if (confirmed) {
          // Retry deletion with force=true
          forceDeleteInvoiceMutation.mutate(invoiceId);
        }
      } else if (responseData?.hasAdjustments) {
        // Adjustments cannot be force deleted
        toast({
          title: "Cannot Delete Invoice",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (errorMessage.includes("Cannot delete invoice") && errorMessage.includes("associated")) {
        // Show confirmation dialog for force delete (for other associated records)
        const confirmed = window.confirm(
          `${errorMessage}\n\nDo you want to permanently delete this invoice and ALL associated records (returns/exchanges, payments)? This action cannot be undone.`
        );

        if (confirmed) {
          // Retry deletion with force=true
          forceDeleteInvoiceMutation.mutate(invoiceId);
        }
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const forceDeleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: number) => invoiceAPI.forceDelete(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice deleted",
        description: "The invoice and all associated records have been permanently removed. Payments have been reversed and account balances updated.",
      });
    },
    onError: (error: any) => {
      console.error("Error force deleting invoice:", error);

      let errorMessage = "Failed to delete invoice. Please try again.";

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Filter invoices based on search term
  const filteredInvoices = invoices?.filter((invoice) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.customer?.name?.toLowerCase().includes(searchLower) ||
      invoice.customer?.phone?.toLowerCase().includes(searchLower) ||
      invoice.status?.toLowerCase().includes(searchLower) ||
      format(new Date(invoice.createdAt), "MMM dd, yyyy, h:mm a").toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = (invoice: any) => {
    if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) {
      deleteInvoiceMutation.mutate(invoice.id);
    }
  };

  const handlePrint = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPrintModalOpen(true);
  };

  // Origin-agnostic: locked once nothing on the invoice remains returnable.
  // A return or exchange never creates a new invoice in this model - it's
  // always the same invoice, for as long as anything on it still has
  // remaining quantity.
  const canReturnInvoice = (invoice: any) => {
    if (!invoice.stockDeducted || invoice.status === "cancelled") {
      return false;
    }
    return getReturnSummary(invoice.items).remainingQuantity > 0;
  };

  // "Scan Invoice": scan a printed receipt's QR (which just encodes the
  // invoice id, same pattern as the product QR labels) and jump straight
  // into Return/Exchange for it - no searching the list required.
  const handleScanInvoice = async (decodedText: string) => {
    try {
      const found = await invoiceAPI.getById(parseInt(decodedText.trim(), 10));
      if (!canReturnInvoice(found)) {
        toast({
          title: "Cannot process return",
          description: `${found.invoiceNumber} has nothing left that can be returned or exchanged.`,
          variant: "destructive",
        });
        return;
      }
      setReturnInvoice(found);
    } catch (error: any) {
      const message = error?.response?.data?.message || "No invoice found for this code.";
      toast({ title: "Scan failed", description: message, variant: "destructive" });
    }
  };

  // After an Exchange, reprint the SAME invoice's updated state (new item,
  // updated history, new total) - there's no separate new invoice to
  // switch to in this model. Plain returns don't auto-print.
  const handleReturnSuccess = (result: CreateReturnResponse) => {
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    if (result?.return?.type === "exchange") {
      setSelectedInvoice(result.invoice);
      setPrintModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-poppins font-bold text-gray-800 dark:text-gray-100 mb-2">
          Invoice History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Past sales recorded through Record Sale
        </p>
      </div>

      {/* Print Invoice Modal */}
      {selectedInvoice && (
        <PrintInvoice
          invoice={selectedInvoice}
          open={printModalOpen}
          onOpenChange={setPrintModalOpen}
        />
      )}

      {/* Invoice Detail Modal */}
      <InvoiceDetailDialog
        invoice={viewInvoice}
        onOpenChange={(open) => !open && setViewInvoice(null)}
      />

      {/* Return / Exchange Modal */}
      <ReturnExchangeDialog
        invoice={returnInvoice}
        onOpenChange={(open) => !open && setReturnInvoice(null)}
        onSuccess={handleReturnSuccess}
      />

      {/* Scan Invoice Modal */}
      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanSuccess={handleScanInvoice}
        title="Scan Invoice QR Code"
      />

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-3">
            <CardTitle className="font-poppins">All Invoices</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                onClick={() => setScannerOpen(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan Invoice
              </Button>
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search invoices by number, customer, status, or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {searchTerm ? "No invoices found matching your search." : "No invoices available."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices?.map((invoice) => {
                  const breakdown = computeInvoiceBreakdown(invoice.items, invoice.returns, invoice.payments, invoice.netAmount);
                  const returnSummary = getReturnSummary(invoice.items);
                  return (
                  <TableRow key={invoice.id} className="table-row-hover">
                    <TableCell className="font-medium max-w-xs">
                      {invoice.invoiceNumber}
                      {breakdown.history.length > 0 && (
                        <div className="text-xs font-normal text-orange-700 dark:text-orange-400 whitespace-normal break-words mt-0.5">
                          {breakdown.history.map((h) => h.description).join("; ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{invoice.customer?.name || 'Unknown'}</span>
                        {invoice.customer?.phone && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer.phone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(invoice.createdAt), "MMM dd, yyyy, h:mm a")}</TableCell>
                    {/* Current Net (Original - Refunded + Additional Paid) -
                        the original stored amount is still fully visible in
                        the detail breakdown; this quick-glance column shows
                        what the invoice is actually worth right now. */}
                    <TableCell>{Math.round(breakdown.netAmount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant={
                            invoice.status === "paid"
                              ? "default"
                              : invoice.status === "partial"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {invoice.status}
                        </Badge>
                        {returnSummary.hasAnyReturn && (
                          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            {returnSummary.isFullyReturned ? "Returned" : "Partially Returned"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 hover:text-slate-800"
                          onClick={() => setViewInvoice(invoice)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => handlePrint(invoice)}
                          title="Print Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {canReturnInvoice(invoice) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-800"
                            onClick={() => setReturnInvoice(invoice)}
                            title="Return / Exchange"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {canManageInvoices && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => handleDelete(invoice)}
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
