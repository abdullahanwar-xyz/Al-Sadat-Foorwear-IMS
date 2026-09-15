import { useQuery } from "@tanstack/react-query";
import { supplierAPI, supplierInvoiceAPI } from "@/service/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPKR } from "@/utils/currency";
import {
  Building2,
  Phone,
  MapPin,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface SupplierDetailsModalProps {
  supplierId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierDetailsModal({
  supplierId,
  open,
  onOpenChange,
}: SupplierDetailsModalProps) {
  // Fetch supplier data
  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => supplierAPI.getById(supplierId),
    enabled: !!supplierId && open,
  });

  // Fetch supplier ledger
  const { data: ledgerData } = useQuery({
    queryKey: ["supplier-ledger", supplierId],
    queryFn: () => supplierAPI.getLedger(supplierId),
    enabled: !!supplierId && open,
  });

  // Fetch supplier invoices
  const { data: invoicesData } = useQuery({
    queryKey: ["supplier-invoices", supplierId],
    queryFn: async () => {
      const result = await supplierInvoiceAPI.getAll({ supplier_id: supplierId });
      return result.data;
    },
    enabled: !!supplierId && open,
  });

  if (supplierLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Loading supplier details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!supplier) {
    return null;
  }

  const transactions = ledgerData?.transactions || [];
  const invoices = invoicesData || [];
  const pendingInvoices = invoices.filter(
    (inv) => inv.status === "pending" || inv.status === "partial"
  );
  const totalPending = pendingInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.pending_amount.toString()),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supplier Details</DialogTitle>
          <DialogDescription>
            View complete information about {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Supplier Name
                  </p>
                  <p className="text-lg font-semibold">{supplier.name}</p>
                </div>
                {supplier.phone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone
                    </p>
                    <p className="text-lg">{supplier.phone}</p>
                  </div>
                )}
                {supplier.address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Address
                    </p>
                    <p className="text-lg">{supplier.address}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <Badge
                    variant={supplier.status === "active" ? "default" : "secondary"}
                  >
                    {supplier.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Opening Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPKR(supplier.opening_balance)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Current Balance
                  {supplier.current_balance > supplier.opening_balance ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : supplier.current_balance < supplier.opening_balance ? (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPKR(supplier.current_balance)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Pending Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatPKR(totalPending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingInvoices.length} pending invoice(s)
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Supplier Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Supplier Invoices ({invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices found for this supplier
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.invoice_id}>
                          <TableCell className="font-medium">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPKR(invoice.total_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPKR(invoice.paid_amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPKR(invoice.pending_amount)}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 10).map((transaction) => (
                        <TableRow key={transaction.trans_id}>
                          <TableCell>
                            {format(
                              new Date(transaction.transaction_date),
                              "dd MMM yyyy"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                transaction.type === "purchase" ? "default" : "secondary"
                              }
                            >
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.description || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPKR(transaction.total_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPKR(transaction.amount_paid)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
