import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AdvancedTable } from "../components/ui/advanced-table";
import { AddProductModal } from "../components/modals/add-product-modal";
import { UpdateProductModal } from "../components/modals/update-product-modal";
import { QrScannerDialog } from "../components/scanner/qr-scanner-dialog";
import { QrLabelDialog, type QrLabelItem } from "../components/scanner/qr-label-dialog";
import { PrintInventoryReport } from "../components/inventory/print-inventory-report";
import { useToast } from "../hooks/use-toast";
import { Plus, Edit, Trash2, Package, Printer, QrCode, X } from "lucide-react";
import { productAPI, productSizeAPI, type Product, type ProductSizeLookup } from "@/service/api";
import { useReactToPrint } from 'react-to-print';

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ProductSizeLookup | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [qrLabelItem, setQrLabelItem] = useState<QrLabelItem | null>(null);

  const handleScanSuccess = async (decodedText: string) => {
    setScanError(null);
    setScanResult(null);
    try {
      const result = await productSizeAPI.lookup(decodedText.trim());
      setScanResult(result);
    } catch (error: any) {
      const message = error?.response?.data?.message || "No item found for this code.";
      setScanError(message);
    }
  };

  // Prints a dedicated, purpose-built report (PrintInventoryReport) rather
  // than a capture of the on-screen interactive table - that table is
  // paginated (10 rows at a time), sortable, and full of buttons/badges
  // that make no sense on paper, and printing it directly used to squeeze
  // whichever single page of it was currently visible onto one sheet.
  // printRef here points at the hidden, off-screen report render below,
  // not the AdvancedTable.
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Product Inventory",
    onAfterPrint: () => {
      toast({
        title: "Print completed",
        description: "The inventory report has been sent to the printer.",
      });
    },
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
    `,
  });

  // Fetch products using the API. Stock-sensitive, so this stays reasonably
  // fresh: refetch on window focus and poll every 30s while the tab is
  // visible (refetchIntervalInBackground defaults to false).
  const { data: products, isLoading, isError, error } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
    // The global QueryClient sets staleTime: Infinity, under which plain
    // `true` here would never actually refetch (it only refetches stale
    // data) - 'always' forces it regardless of staleness.
    refetchOnWindowFocus: "always",
    refetchInterval: 30000,
  });

  // Calling toast() directly in the render body would call its setState
  // synchronously on every render while isError stays true, which is the
  // "Too many re-renders" crash - it belongs in an effect so it only fires
  // when the error actually changes.
  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory data. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  const deleteProductMutation = useMutation({
    mutationFn: (productId: number) => productAPI.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "The product has been removed from your inventory.",
      });
    },
    onError: (error: any, productId: number) => {
      console.error("Error deleting product:", error);
      
      // Check if it's a constraint error with associated records
      let errorMessage = "Failed to delete product. Please try again.";
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // The backend blocks deletion when the product has real invoice
      // history and suggests archiving instead - offer that here rather
      // than any kind of force-delete-everything option.
      if (errorMessage.includes("Cannot delete this product")) {
        const confirmed = window.confirm(
          `${errorMessage}\n\nArchive it instead? It will be hidden from active use but its sales history stays intact.`
        );

        if (confirmed) {
          archiveProductMutation.mutate(productId);
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

  const archiveProductMutation = useMutation({
    mutationFn: (productId: number) => productAPI.update(productId, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product archived",
        description: "The product is hidden from active use; its history is preserved.",
      });
    },
    onError: (error: any) => {
      console.error("Error archiving product:", error);

      let errorMessage = "Failed to archive product. Please try again.";

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

  const handleDelete = (productId: number) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(productId);
    }
  };

  const getStockStatus = (totalStock: number) => {
    if (totalStock === 0) return { status: 'out', color: 'bg-red-500 dark:bg-red-600', text: 'Out of Stock', animation: 'animate-pulse' };
    if (totalStock <= 20) return { status: 'poor', color: 'bg-red-400 dark:bg-red-500', text: 'Low Stock', animation: 'animate-bounce' };
    if (totalStock <= 50) return { status: 'normal', color: 'bg-yellow-400 dark:bg-yellow-500', text: 'Normal', animation: 'animate-pulse' };
    return { status: 'good', color: 'bg-green-500 dark:bg-green-600', text: 'Good Stock', animation: '' };
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "DULL":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
      case "Champagne":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
      case "White/PC-RAL":
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
      case "Sahra BRN":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
      case "Black":
        return "bg-slate-800 dark:bg-slate-700 text-white";
      case "Multi Wood":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200";
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-sora font-bold text-slate-800 dark:text-slate-100 mb-2">
            Footwear Inventory Management
          </h1>
          <div className="flex items-center space-x-4 text-slate-600 dark:text-slate-400">
            <span>{products?.length || 0} total designs</span>
            {products && products.length > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center space-x-4">
                  {/* Total Stock in Pieces */}
                  <div className="flex items-center space-x-2">
                    <span>Total Stock:</span>
                    {(() => {
                      const totalStock = products.reduce((total, product) => 
                        total + (product.colorRates?.reduce((colorTotal: number, cr: any) => 
                          colorTotal + (cr.sizes?.reduce((sizeTotal: number, size: any) => sizeTotal + size.quantity, 0) || 0), 0
                        ) || 0), 0
                      );
                      const stockStatus = getStockStatus(totalStock);
                      return (
                        <div className="flex items-center space-x-1">
                          <div className={`w-3 h-3 rounded-full ${stockStatus.color} ${stockStatus.animation}`}></div>
                          <span className="font-medium">{totalStock} pieces</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
            onClick={() => {
              setScanError(null);
              setScannerOpen(true);
            }}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Scan
          </Button>
          <Button
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Inventory
          </Button>
          <AddProductModal
            trigger={
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            }
          />
        </div>
      </div>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanSuccess={handleScanSuccess}
        title="Scan Item QR Code"
      />

      <QrLabelDialog
        item={qrLabelItem}
        onOpenChange={(open) => !open && setQrLabelItem(null)}
      />

      {scanError && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <span className="text-red-600 dark:text-red-400 text-sm">{scanError}</span>
            <Button variant="ghost" size="icon" onClick={() => setScanError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {scanResult && (
        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-sora text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" />
              Scanned Item
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setScanResult(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Product</div>
              <div className="font-medium">{scanResult.productName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Collection</div>
              <div className="font-medium">{scanResult.collection}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Color</div>
              <div className="font-medium">{scanResult.color}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Size</div>
              <div className="font-medium">{scanResult.size}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Current Stock</div>
              <div className={`font-bold ${scanResult.quantity === 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {scanResult.quantity} pieces
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Inventory Table (on-screen only - Print Inventory renders
          a separate, dedicated report; see PrintInventoryReport below) */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="font-sora text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Footwear Products Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isError && !products ? (
              <div className="text-center p-6 text-red-600 dark:text-red-400">
                Failed to load products. Please refresh and try again.
              </div>
            ) : (
              <AdvancedTable
                data={products || []}
                columns={[
                  {
                    id: "name",
                    label: "Product",
                    sortable: true,
                    filterable: true,
                    render: (value) => (
                      <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span>
                    )
                  },
                  {
                    id: "collection",
                    label: "Collection",
                    sortable: true,
                    filterable: true,
                    render: (value) => (
                      <Badge variant="secondary">{value}</Badge>
                    )
                  },
                  // Stock Overview Column
                  {
                    id: "stock",
                    label: "Stock Overview",
                    sortable: true,
                    render: (_, item) => {
                      const totalStock = item.colorRates?.reduce((total: number, cr: any) => 
                        total + (cr.sizes?.reduce((sizeTotal: number, size: any) => sizeTotal + size.quantity, 0) || 0), 0
                      ) || 0;
                      const stockStatus = getStockStatus(totalStock);
                      
                      return (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${stockStatus.color} ${stockStatus.animation}`}></div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{totalStock} pieces</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full inline-block w-fit ${
                            stockStatus.status === 'out' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                            stockStatus.status === 'poor' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                            stockStatus.status === 'normal' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          }`}>
                            {stockStatus.text}
                          </span>
                        </div>
                      );
                    }
                  },
                  // Replace the "Color Rates" column with individual color columns with stock details
                  ...(products && products.length > 0 && products[0].colorRates
                    ? 
                    // Get unique colors across all products
                    [...new Set(products.flatMap((p: Product) => p.colorRates.map((cr: { color: string }) => cr.color)))].map((color: string) => ({
                      // Use a string id, but cast to 'any' to satisfy the Column<Product> type
                      id: `color_${color}` as any,
                      // "Standard" is the internal placeholder name for single-variant
                      // products (no real color entered) - show a plain "Price" header
                      // instead of surfacing that implementation detail to shop owners.
                      label: color === "Standard" ? "Price" : color,
                      sortable: false,
                      render: (_: unknown, item: Product) => {
                        const colorRate = item.colorRates?.find((cr: { color: string }) => cr.color === color);
                        if (!colorRate) return <span className="text-gray-400 dark:text-gray-500">-</span>;
                        
                        const colorStock = colorRate.sizes?.reduce((total: number, size: any) => total + size.quantity, 0) || 0;
                        const colorStockStatus = getStockStatus(colorStock);
                        
                        return (
                          <div className="space-y-2">
                            {/* Color name, repeated here (not just in the column header)
                                so each block is self-explanatory once the header has
                                scrolled out of view - "Standard" is the internal
                                placeholder for single-variant products, so it's skipped
                                the same way the header already substitutes "Price" for it. */}
                            {color !== "Standard" && (
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {color}
                              </div>
                            )}
                            {/* Rate */}
                            <div className="text-right">
                              <span className={`px-2 py-1 rounded-md inline-block text-sm font-medium ${getCategoryColor(color)}`}>
                                {colorRate.rate.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* Stock by Size */}
                            <div className="space-y-1">
                              {colorRate.sizes?.map((size: any) => (
                                <div key={size.id} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-600 dark:text-slate-400">{size.size}:</span>
                                  <div className="flex items-center space-x-1">
                                    <span className={`font-medium ${
                                      size.quantity === 0 ? 'text-red-600 dark:text-red-400' :
                                      size.quantity <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-green-600 dark:text-green-400'
                                    }`}>
                                      {size.quantity}
                                    </span>
                                    {size.quantity <= 10 && size.quantity > 0 && (
                                      <div className="w-2 h-2 bg-yellow-400 dark:bg-yellow-500 rounded-full animate-pulse"></div>
                                    )}
                                    {size.quantity === 0 && (
                                      <div className="w-2 h-2 bg-red-500 dark:bg-red-600 rounded-full animate-bounce"></div>
                                    )}
                                    <button
                                      type="button"
                                      title="View/Print QR label"
                                      onClick={() =>
                                        setQrLabelItem({
                                          productSizeId: size.id,
                                          productName: item.name,
                                          collection: item.collection,
                                          color: colorRate.color,
                                          size: size.size,
                                        })
                                      }
                                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex-shrink-0"
                                    >
                                      <QrCode className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )) || <span className="text-xs text-gray-400 dark:text-gray-500">No sizes</span>}
                              
                              {/* Total for this color */}
                              <div className="pt-1 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Total:</span>
                                  <div className="flex items-center space-x-1">
                                    <div className={`w-2 h-2 rounded-full ${colorStockStatus.color} ${colorStockStatus.animation}`}></div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{colorStock}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    }))
                    : []
                  ),
                  {
                    id: "id",
                    label: "Actions",
                    render: (value, item) => (
                      <div className="flex space-x-2">
                        <UpdateProductModal 
                          product={item}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => handleDelete(value)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  }
                ]}
                searchPlaceholder="Search by product name, collection..."
                pageSize={10}
                showPagination={true}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Off-screen on purpose: this is what Print Inventory actually
          prints (see handlePrint above), not the interactive table shown
          on screen. Kept out of view with a fixed offset rather than
          display:none, since some print pipelines skip non-rendered
          content. */}
      <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
        <PrintInventoryReport ref={printRef} products={products || []} />
      </div>
    </div>
  );
}