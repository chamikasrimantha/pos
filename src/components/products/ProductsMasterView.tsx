// src/components/products/ProductsMasterView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { getProducts, getVariants, getCategories, getBrands } from "@/lib/firestore-service";
import { formatCurrency, renderThermalBarcodeLabelHTML } from "@/lib/receipt-generator";
import { ProductVariant } from "@/types";
import { Tag, Barcode, Printer, Search, X } from "lucide-react";

export function ProductsMasterView() {
  const { openPrintModal, currentUser, dataVersion } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState<ProductVariant | null>(null);
  const [barcodeLabelCopies, setBarcodeLabelCopies] = useState("4");

  const canSeeCost = currentUser?.role === "SUPER_ADMIN";

  const products = useMemo(() => getProducts(), [dataVersion]);
  const variants = useMemo(() => getVariants(), [dataVersion]);
  const categories = useMemo(() => getCategories(), [dataVersion]);
  const brands = useMemo(() => getBrands(), [dataVersion]);

  const filteredVariants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return variants;
    return variants.filter(
      (v) =>
        v.productNameCache.toLowerCase().includes(q) ||
        v.brandNameCache.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.barcode.includes(q) ||
        v.colorNameCache.toLowerCase().includes(q) ||
        v.sizeLabelCache.toLowerCase().includes(q)
    );
  }, [variants, searchQuery]);

  // Generate printable vector SVG thermal barcode labels (Section 8)
  const handlePrintBarcodes = () => {
    if (!selectedVariantForBarcode) return;
    const copies = Math.max(1, parseInt(barcodeLabelCopies) || 1);

    const labelHTML = renderThermalBarcodeLabelHTML(selectedVariantForBarcode, copies);

    openPrintModal(`Barcode Labels — ${selectedVariantForBarcode.sku}`, labelHTML);
    setSelectedVariantForBarcode(null);
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            Product Catalog
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Footwear models, SKUs, EAN-13 barcodes, and thermal box sticker printing.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px", height: "40px", width: "280px" }}>
          <Search size={16} color="var(--ink-3)" style={{ marginRight: "6px" }} />
          <input
            type="text"
            placeholder="Search model, brand or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: "var(--ink)", width: "100%" }}
          />
        </div>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Shoe Models</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
            {products.length} models
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Sellable Variants</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
            {variants.length} SKUs
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Brands Represented</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
            {brands.length} brands
          </div>
        </div>
      </div>

      {/* Product Variants Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pos-table">
            <thead>
              <tr>
                <th>Shoe model</th>
                <th>Brand</th>
                <th>Colour</th>
                <th>Size</th>
                <th>SKU</th>
                <th>Barcode</th>
                {canSeeCost && <th className="num">Cost (ref)</th>}
                <th className="num">Selling price</th>
                <th style={{ textAlign: "right" }}>Label</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: "700", color: "var(--ink)" }}>{v.productNameCache}</td>
                  <td style={{ color: "var(--ink-2)" }}>{v.brandNameCache}</td>
                  <td style={{ color: "var(--ink-2)" }}>{v.colorNameCache}</td>
                  <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{v.sizeLabelCache}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "13px", color: "var(--ink-3)" }}>{v.sku}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "13px", color: "var(--ink-3)" }}>{v.barcode}</td>
                  {canSeeCost && (
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                      {formatCurrency(v.referenceCostPrice)}
                    </td>
                  )}
                  <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(v.sellingPrice)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedVariantForBarcode(v)}
                      title="Print vector barcode label"
                      style={{ height: "32px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Barcode size={14} /> Print labels
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT BARCODE LABELS MODAL */}
      {selectedVariantForBarcode && (
        <div className="modal-backdrop">
          <div className="modal-panel animate-fade-in" style={{ maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Barcode size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>Print Barcode Labels</h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>50 &times; 30mm Vector Thermal Sticker</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVariantForBarcode(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-control)", marginBottom: "18px", fontSize: "13px", lineHeight: "1.6" }}>
              <div><strong style={{ color: "var(--ink)" }}>Shoe:</strong> {selectedVariantForBarcode.productNameCache}</div>
              <div><strong style={{ color: "var(--ink)" }}>Colour / Size:</strong> {selectedVariantForBarcode.colorNameCache} &mdash; {selectedVariantForBarcode.sizeLabelCache}</div>
              <div><strong style={{ color: "var(--ink)" }}>Barcode:</strong> <span style={{ fontVariantNumeric: "tabular-nums" }}>{selectedVariantForBarcode.barcode}</span></div>
              <div><strong style={{ color: "var(--ink)" }}>Retail Price:</strong> <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: "700" }}>{formatCurrency(selectedVariantForBarcode.sellingPrice)}</span></div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Number of label copies to print
              </label>
              <input
                type="number"
                min="1"
                max="50"
                className="input-field"
                value={barcodeLabelCopies}
                onChange={(e) => setBarcodeLabelCopies(e.target.value)}
                style={{ height: "42px", fontSize: "15px", width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedVariantForBarcode(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePrintBarcodes}>
                <Printer size={15} /> Print Labels
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
