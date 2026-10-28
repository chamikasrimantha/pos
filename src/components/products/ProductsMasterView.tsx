// src/components/products/ProductsMasterView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { getProducts, getVariants, getCategories, getBrands, getInventoryForShop } from "@/lib/firestore-service";
import {
  formatCurrency,
  renderThermalBarcodeLabelHTML,
  renderBatchThermalBarcodeLabelsHTML,
  renderA4BarcodeSheetHTML,
  renderSingleThermalBarcodeLabel,
} from "@/lib/receipt-generator";
import { ProductVariant } from "@/types";
import { Tag, Barcode, Printer, Search, X, CheckSquare, Square, Layers, Sparkles, Filter, Check } from "lucide-react";

export function ProductsMasterView() {
  const { openPrintModal, currentUser, activeShop, dataVersion } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("ALL");
  const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState<ProductVariant | null>(null);
  const [barcodeLabelCopies, setBarcodeLabelCopies] = useState("4");
  const [printFormat, setPrintFormat] = useState<"THERMAL_50x30" | "A4_SHEET">("THERMAL_50x30");

  // Batch Print Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [batchCopiesMode, setBatchCopiesMode] = useState<"FIXED" | "STOCK">("FIXED");
  const [batchFixedCopies, setBatchFixedCopies] = useState("2");

  const canSeeCost = currentUser?.role === "SUPER_ADMIN";

  const products = useMemo(() => getProducts(), [dataVersion]);
  const variants = useMemo(() => getVariants(), [dataVersion]);
  const categories = useMemo(() => getCategories(), [dataVersion]);
  const brands = useMemo(() => getBrands(), [dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);

  // Inventory quantity map: variantId -> qty
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryList.forEach((inv) => {
      map[inv.variantId] = inv.quantityOnHand;
    });
    return map;
  }, [inventoryList]);

  const filteredVariants = useMemo(() => {
    let list = variants;
    if (selectedBrandFilter !== "ALL") {
      list = list.filter((v) => v.brandNameCache === selectedBrandFilter);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.productNameCache.toLowerCase().includes(q) ||
        v.brandNameCache.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.barcode.includes(q) ||
        v.colorNameCache.toLowerCase().includes(q) ||
        v.sizeLabelCache.toLowerCase().includes(q)
    );
  }, [variants, selectedBrandFilter, searchQuery]);

  // Handle single variant label print
  const handlePrintSingleBarcode = () => {
    if (!selectedVariantForBarcode) return;
    const copies = Math.max(1, parseInt(barcodeLabelCopies) || 1);
    const shopName = activeShop?.name || "Apex Footwear";

    let labelHTML = "";
    if (printFormat === "A4_SHEET") {
      labelHTML = renderA4BarcodeSheetHTML([{ variant: selectedVariantForBarcode, copies }], shopName);
    } else {
      labelHTML = renderThermalBarcodeLabelHTML(selectedVariantForBarcode, copies, shopName);
    }

    openPrintModal(
      `Barcode Labels — ${selectedVariantForBarcode.sku} (${copies} ${copies === 1 ? "copy" : "copies"})`,
      labelHTML
    );
    setSelectedVariantForBarcode(null);
  };

  // Toggle selection for batch print
  const toggleVariantSelection = (id: string) => {
    const next = new Set(selectedVariantIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedVariantIds(next);
  };

  const handleSelectAllFiltered = () => {
    if (selectedVariantIds.size === filteredVariants.length) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(filteredVariants.map((v) => v.id)));
    }
  };

  // Execute batch label print
  const handlePrintBatch = () => {
    const selectedList = variants.filter((v) => selectedVariantIds.has(v.id));
    if (selectedList.length === 0) return;

    const shopName = activeShop?.name || "Apex Footwear";
    const items = selectedList.map((variant) => {
      let copies = 1;
      if (batchCopiesMode === "STOCK") {
        copies = Math.max(1, stockMap[variant.id] || 1);
      } else {
        copies = Math.max(1, parseInt(batchFixedCopies) || 1);
      }
      return { variant, copies };
    });

    const totalLabels = items.reduce((acc, it) => acc + it.copies, 0);

    let labelHTML = "";
    if (printFormat === "A4_SHEET") {
      labelHTML = renderA4BarcodeSheetHTML(items, shopName);
    } else {
      labelHTML = renderBatchThermalBarcodeLabelsHTML(items, shopName);
    }

    openPrintModal(`Batch Barcode Labels — ${selectedList.length} SKUs (${totalLabels} labels)`, labelHTML);
    setIsBatchModalOpen(false);
  };

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header & Action Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "14px",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "var(--primary-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Barcode size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", margin: 0, letterSpacing: "-0.3px" }}>
                Product Catalog & Barcodes
              </h1>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                Footwear models, vector thermal labels (50×30mm), and A4 sticker sheet printing.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", width: "100%", maxWidth: "460px", justifyContent: "flex-end" }}>
          {/* Search Box with sleek pill radius */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "9999px",
              padding: "0 14px",
              height: "42px",
              flex: "1 1 200px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <Search size={16} color="var(--ink-3)" style={{ marginRight: "8px", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search model, brand, barcode…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "14px",
                color: "var(--ink)",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: "2px" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Batch Print Button */}
          <button
            className="btn btn-primary"
            onClick={() => {
              if (selectedVariantIds.size === 0) {
                // Select all currently filtered variants by default
                setSelectedVariantIds(new Set(filteredVariants.map((v) => v.id)));
              }
              setIsBatchModalOpen(true);
            }}
            style={{
              borderRadius: "12px",
              height: "42px",
              padding: "0 16px",
              fontSize: "14px",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              boxShadow: "0 2px 8px rgba(32, 86, 200, 0.25)",
            }}
          >
            <Printer size={16} />
            <span>Batch Print Labels</span>
          </button>
        </div>
      </div>

      {/* Brand Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          padding: "6px 2px",
          scrollbarWidth: "none",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setSelectedBrandFilter("ALL")}
          style={{
            borderRadius: "9999px",
            padding: "0 16px",
            height: "36px",
            fontSize: "13px",
            fontWeight: "700",
            border: selectedBrandFilter === "ALL" ? "1px solid var(--primary)" : "1px solid var(--line-strong)",
            background: selectedBrandFilter === "ALL" ? "var(--primary)" : "var(--surface)",
            color: selectedBrandFilter === "ALL" ? "#ffffff" : "var(--ink-2)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          All Brands ({variants.length})
        </button>
        {brands.map((b) => {
          const count = variants.filter((v) => v.brandNameCache === b.name).length;
          const isSelected = selectedBrandFilter === b.name;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBrandFilter(b.name)}
              style={{
                borderRadius: "9999px",
                padding: "0 16px",
                height: "36px",
                fontSize: "13px",
                fontWeight: "700",
                border: isSelected ? "1px solid var(--primary)" : "1px solid var(--line)",
                background: isSelected ? "var(--primary)" : "var(--surface)",
                color: isSelected ? "#ffffff" : "var(--ink)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {b.name} ({count})
            </button>
          );
        })}
      </div>

      {/* KPI Tiles with Modern Border-Radius */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Shoe Models
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
            {products.length}
          </div>
        </div>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Sellable SKUs
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
            {variants.length}
          </div>
        </div>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            In-Stock Pairs ({activeShop.name})
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--primary)", marginTop: "4px" }}>
            {Object.values(stockMap).reduce((a, b) => a + b, 0)}
          </div>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW — Fit to screen without horizontal scrolling */}
      <div
        className="desktop-only-table"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          width: "100%",
        }}
      >
        <div style={{ width: "100%", overflowX: "hidden" }}>
          <table className="pos-table" style={{ width: "100%", tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ width: "38px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedVariantIds.size > 0 && selectedVariantIds.size === filteredVariants.length}
                    onChange={handleSelectAllFiltered}
                    style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary)" }}
                  />
                </th>
                <th>Shoe Model & Brand</th>
                <th style={{ width: "160px" }}>Variant (Color & Size)</th>
                <th style={{ width: "180px" }}>SKU & Barcode</th>
                <th className="num" style={{ width: "140px" }}>Stock & Price</th>
                <th
                  style={{
                    width: "140px",
                    textAlign: "right",
                    paddingRight: "16px",
                    position: "sticky",
                    right: 0,
                    background: "var(--surface-sunken)",
                    zIndex: 2,
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((v) => {
                const isChecked = selectedVariantIds.has(v.id);
                const qoh = stockMap[v.id] || 0;
                return (
                  <tr key={v.id} style={{ background: isChecked ? "var(--primary-soft)" : "transparent" }}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleVariantSelection(v.id)}
                        style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary)" }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--ink)", fontSize: "14px" }}>
                        {v.productNameCache}
                      </div>
                      <div style={{ display: "inline-block", fontSize: "11px", fontWeight: "700", color: "var(--ink-2)", marginTop: "2px" }}>
                        {v.brandNameCache}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: "500" }}>
                        {v.colorNameCache}
                      </div>
                      <span className="badge badge-neutral" style={{ borderRadius: "9999px", fontSize: "11px", marginTop: "2px" }}>
                        {v.sizeLabelCache}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontVariantNumeric: "tabular-nums", fontSize: "12px", color: "var(--ink-2)", fontFamily: "monospace" }}>
                        {v.sku}
                      </div>
                      <div style={{ fontVariantNumeric: "tabular-nums", fontSize: "12px", color: "var(--ink-3)", fontFamily: "monospace" }}>
                        {v.barcode}
                      </div>
                    </td>
                    <td className="num">
                      <div style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontSize: "14px" }}>
                        {formatCurrency(v.sellingPrice)}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "1px" }}>
                        <span style={{ color: qoh > 0 ? "var(--success)" : "var(--danger)" }}>
                          {qoh} in stock
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingRight: "16px",
                        position: "sticky",
                        right: 0,
                        background: isChecked ? "var(--primary-soft)" : "var(--surface)",
                        zIndex: 1,
                        boxShadow: "-2px 0 6px rgba(0,0,0,0.03)",
                      }}
                    >
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedVariantForBarcode(v)}
                        style={{
                          height: "32px",
                          fontSize: "12px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "0 10px",
                          fontWeight: "700",
                        }}
                      >
                        <Barcode size={13} style={{ color: "var(--primary)" }} />
                        <span>Print label</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE RESPONSIVE CARD VIEW (shown on mobile phones < 768px) */}
      <div className="mobile-only-cards" style={{ display: "none", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink-2)" }}>
            Showing {filteredVariants.length} Products
          </span>
          <button
            onClick={handleSelectAllFiltered}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {selectedVariantIds.size === filteredVariants.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        {filteredVariants.map((v) => {
          const isChecked = selectedVariantIds.has(v.id);
          const qoh = stockMap[v.id] || 0;
          return (
            <div
              key={v.id}
              style={{
                background: "var(--surface)",
                border: isChecked ? "2px solid var(--primary)" : "1px solid var(--line)",
                borderRadius: "16px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleVariantSelection(v.id)}
                    style={{
                      marginTop: "3px",
                      width: "18px",
                      height: "18px",
                      accentColor: "var(--primary)",
                      cursor: "pointer",
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        color: "var(--primary-ink)",
                        background: "var(--primary-soft)",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                      }}
                    >
                      {v.brandNameCache}
                    </span>
                    <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)", margin: "4px 0 2px" }}>
                      {v.productNameCache}
                    </h3>
                    <div style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                      {v.colorNameCache} &bull; <strong style={{ color: "var(--ink)" }}>{v.sizeLabelCache}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)" }}>
                    {formatCurrency(v.sellingPrice)}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: qoh > 0 ? "var(--success)" : "var(--danger)" }}>
                    {qoh} in stock
                  </div>
                </div>
              </div>

              {/* Barcode & Actions footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--line)",
                  paddingTop: "10px",
                  marginTop: "2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Barcode size={16} color="var(--ink-3)" />
                  <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: "var(--ink-2)" }}>
                    {v.barcode}
                  </span>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedVariantForBarcode(v)}
                  style={{
                    height: "36px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Printer size={14} style={{ color: "var(--primary)" }} />
                  <span>Print Label</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* SINGLE ITEM PRINT BARCODE MODAL WITH LIVE PREVIEW */}
      {selectedVariantForBarcode && (
        <div className="modal-backdrop">
          <div
            className="modal-panel animate-fade-in"
            style={{
              maxWidth: "460px",
              width: "100%",
              borderRadius: "20px",
              padding: "24px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "var(--primary-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                  }}
                >
                  <Barcode size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                    Print Barcode Label
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Standard footwear box label with crisp vector bars
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVariantForBarcode(null)}
                style={{
                  background: "var(--surface-sunken)",
                  border: "none",
                  borderRadius: "9999px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--ink-2)",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Interactive Sticker Preview */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-2)", marginBottom: "6px" }}>
                Label Preview (50×30mm Physical Aspect):
              </div>
              <div
                style={{
                  background: "#e8ecf2",
                  padding: "16px",
                  borderRadius: "14px",
                  display: "flex",
                  justifyContent: "center",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
                }}
                dangerouslySetInnerHTML={{
                  __html: renderSingleThermalBarcodeLabel(selectedVariantForBarcode, activeShop?.name || "Apex Footwear"),
                }}
              />
            </div>

            {/* Print Options Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Copies to Print
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="input-field"
                  value={barcodeLabelCopies}
                  onChange={(e) => setBarcodeLabelCopies(e.target.value)}
                  style={{
                    height: "44px",
                    borderRadius: "12px",
                    fontSize: "15px",
                    fontWeight: "700",
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Printer Layout
                </label>
                <select
                  value={printFormat}
                  onChange={(e) => setPrintFormat(e.target.value as any)}
                  className="input-field"
                  style={{
                    height: "44px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    width: "100%",
                  }}
                >
                  <option value="THERMAL_50x30">Thermal Roll (50×30mm)</option>
                  <option value="A4_SHEET">A4 Sheet (24 labels/pg)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedVariantForBarcode(null)}
                style={{ borderRadius: "12px", height: "44px", padding: "0 18px", fontWeight: "600" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePrintSingleBarcode}
                style={{
                  borderRadius: "12px",
                  height: "44px",
                  padding: "0 22px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  boxShadow: "0 2px 8px rgba(32, 86, 200, 0.3)",
                }}
              >
                <Printer size={16} /> Print Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH PRINT BARCODE LABELS MODAL */}
      {isBatchModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-panel animate-fade-in"
            style={{
              maxWidth: "520px",
              width: "100%",
              borderRadius: "20px",
              padding: "24px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "var(--primary-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                  }}
                >
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "19px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                    Batch Barcode Label Hub
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Print stickers for multiple inventory items in one single pass
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                style={{
                  background: "var(--surface-sunken)",
                  border: "none",
                  borderRadius: "9999px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--ink-2)",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Selection summary */}
            <div
              style={{
                background: "var(--primary-soft)",
                border: "1px solid var(--primary-soft-line)",
                borderRadius: "14px",
                padding: "14px 16px",
                marginBottom: "18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-ink)" }}>
                  {selectedVariantIds.size} Models Selected for Printing
                </div>
                <div style={{ fontSize: "12px", color: "var(--primary-ink)", opacity: 0.85, marginTop: "2px" }}>
                  Outlet: {activeShop.name}
                </div>
              </div>
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: "9999px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                {selectedVariantIds.size === filteredVariants.length ? "Clear Selection" : "Select All"}
              </button>
            </div>

            {/* Copies Strategy */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                How Many Labels per Item?
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setBatchCopiesMode("FIXED")}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: batchCopiesMode === "FIXED" ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: batchCopiesMode === "FIXED" ? "var(--primary-soft)" : "var(--surface)",
                    color: batchCopiesMode === "FIXED" ? "var(--primary-ink)" : "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  <div>Fixed Quantity</div>
                  <div style={{ fontSize: "11px", fontWeight: "500", color: "var(--ink-2)", marginTop: "3px" }}>
                    Same number of labels for every item
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchCopiesMode("STOCK")}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: batchCopiesMode === "STOCK" ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: batchCopiesMode === "STOCK" ? "var(--primary-soft)" : "var(--surface)",
                    color: batchCopiesMode === "STOCK" ? "var(--primary-ink)" : "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  <div>Match Shop Stock</div>
                  <div style={{ fontSize: "11px", fontWeight: "500", color: "var(--ink-2)", marginTop: "3px" }}>
                    Print exact pairs in stock ({activeShop.name})
                  </div>
                </button>
              </div>

              {batchCopiesMode === "FIXED" && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink-2)" }}>Copies each:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={batchFixedCopies}
                    onChange={(e) => setBatchFixedCopies(e.target.value)}
                    className="input-field"
                    style={{ width: "90px", height: "40px", borderRadius: "10px", fontSize: "14px", fontWeight: "700" }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["1", "2", "4", "10"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBatchFixedCopies(n)}
                        style={{
                          background: batchFixedCopies === n ? "var(--primary)" : "var(--surface-sunken)",
                          color: batchFixedCopies === n ? "#fff" : "var(--ink-2)",
                          border: "none",
                          borderRadius: "8px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Print Layout */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                Target Printer / Paper Media
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPrintFormat("THERMAL_50x30")}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: printFormat === "THERMAL_50x30" ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: printFormat === "THERMAL_50x30" ? "var(--primary-soft)" : "var(--surface)",
                    color: printFormat === "THERMAL_50x30" ? "var(--primary-ink)" : "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  <div>Thermal Roll Sticker</div>
                  <div style={{ fontSize: "11px", fontWeight: "500", color: "var(--ink-2)", marginTop: "2px" }}>
                    50×30mm roll printers (Zebra, Xprinter)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintFormat("A4_SHEET")}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: printFormat === "A4_SHEET" ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: printFormat === "A4_SHEET" ? "var(--primary-soft)" : "var(--surface)",
                    color: printFormat === "A4_SHEET" ? "var(--primary-ink)" : "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  <div>A4 Multi-Sticker Sheet</div>
                  <div style={{ fontSize: "11px", fontWeight: "500", color: "var(--ink-2)", marginTop: "2px" }}>
                    24 labels/sheet for standard office printers
                  </div>
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsBatchModalOpen(false)}
                style={{ borderRadius: "12px", height: "44px", padding: "0 18px", fontWeight: "600" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePrintBatch}
                disabled={selectedVariantIds.size === 0}
                style={{
                  borderRadius: "12px",
                  height: "44px",
                  padding: "0 24px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 10px rgba(32, 86, 200, 0.3)",
                }}
              >
                <Printer size={16} />
                <span>
                  Print {selectedVariantIds.size} Items (
                  {batchCopiesMode === "STOCK"
                    ? Array.from(selectedVariantIds).reduce((acc, id) => acc + Math.max(1, stockMap[id] || 1), 0)
                    : selectedVariantIds.size * (parseInt(batchFixedCopies) || 1)}{" "}
                  Labels)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
