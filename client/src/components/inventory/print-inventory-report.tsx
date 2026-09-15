import { Fragment, forwardRef } from "react";
import type { CSSProperties } from "react";
import { format } from "date-fns";
import type { Product } from "@/service/api";

interface PrintInventoryReportProps {
  products: Product[];
}

// Same threshold the on-screen inventory table uses for its per-size
// color-coded dots (quantity <= 10 and > 0 -> yellow "low stock" dot,
// quantity === 0 -> red "out of stock" dot) - kept here as one named
// constant so both "low stock" states share a single source of truth.
const LOW_STOCK_THRESHOLD = 10;

interface SizeEntry {
  size: number;
  quantity: number;
}

interface ReportRow {
  key: string;
  productName: string;
  collection: string;
  color: string;
  rate: number;
  sizes: SizeEntry[];
  totalStock: number;
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "2mm",
  borderTop: "1.5px solid #000",
  borderBottom: "1.5px solid #000",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "1.5mm 2mm",
  borderBottom: "0.5px solid #999",
  verticalAlign: "top",
};

// A dedicated, purpose-built print layout - NOT a capture of the on-screen
// interactive table (which is paginated, sortable, and full of buttons/
// badges that make no sense on paper). One row per product/color
// combination, real <table> semantics so thead repeats and rows don't
// split across pages (see the global .print-container rules in index.css:
// thead { display: table-header-group } and tr { page-break-inside:
// avoid }), same print-container pattern print-invoice.tsx/qr-label-dialog
// already use.
export const PrintInventoryReport = forwardRef<HTMLDivElement, PrintInventoryReportProps>(
  ({ products }, ref) => {
    const rows: ReportRow[] = products.flatMap((product) =>
      (product.colorRates || []).map((cr) => {
        const sizes = [...(cr.sizes || [])].sort((a, b) => a.size - b.size);
        const totalStock = sizes.reduce((sum, s) => sum + s.quantity, 0);
        return {
          key: `${product.id}-${cr.id}`,
          productName: product.name,
          collection: product.collection,
          // "Standard" is the internal placeholder for a single-variant
          // product with no real color entered - same substitution used on
          // the on-screen inventory table.
          color: cr.color === "Standard" ? "-" : cr.color,
          rate: cr.rate,
          sizes,
          totalStock,
        };
      })
    );

    const grandTotalStock = rows.reduce((sum, r) => sum + r.totalStock, 0);

    return (
      <div
        ref={ref}
        className="print-container"
        style={{ padding: "5mm", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", background: "#fff" }}
      >
        <div style={{ textAlign: "center", marginBottom: "4mm" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>Al Sadat Footwear</div>
          <div style={{ fontSize: "12px" }}>Product Inventory Report</div>
          <div style={{ fontSize: "9px", color: "#555" }}>
            Printed: {format(new Date(), "dd/MM/yyyy, h:mm a")}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3mm" }}>
          <span>{products.length} product design(s) &middot; {rows.length} product/color line(s)</span>
          <span>
            Total Stock: <strong>{grandTotalStock} pieces</strong>
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Collection</th>
              <th style={thStyle}>Color</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Price (Rs)</th>
              <th style={thStyle}>Stock by Size</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td style={{ ...tdStyle, fontWeight: "bold" }}>{row.productName}</td>
                <td style={tdStyle}>{row.collection}</td>
                <td style={tdStyle}>{row.color}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{row.rate.toFixed(2)}</td>
                <td style={tdStyle}>
                  {row.sizes.length > 0 ? (
                    row.sizes.map((s, i) => (
                      <Fragment key={s.size}>
                        {i > 0 && <span style={{ color: "#999" }}> | </span>}
                        <span style={s.quantity <= LOW_STOCK_THRESHOLD ? { fontWeight: "bold" } : undefined}>
                          {s.size}:{s.quantity}
                        </span>
                      </Fragment>
                    ))
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{row.totalStock}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan={6}>No products to display.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...tdStyle, fontWeight: "bold", borderTop: "1.5px solid #000" }} colSpan={5}>
                Grand Total
              </td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", borderTop: "1.5px solid #000" }}>
                {grandTotalStock}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ fontSize: "9px", color: "#555", marginTop: "2mm" }}>
          <strong>Bold</strong> size:qty pairs = low stock ({LOW_STOCK_THRESHOLD} or fewer remaining, including out of stock)
        </div>
      </div>
    );
  }
);
PrintInventoryReport.displayName = "PrintInventoryReport";
