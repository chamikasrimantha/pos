// src/components/products/LabelEditorModal.tsx
"use client";

import React, { useState } from "react";
import { ProductVariant } from "@/types";
import { useApp } from "@/context/AppContext";
import {
  BarcodeLabelSize,
  renderSingleThermalBarcodeLabel,
  renderThermalBarcodeLabelHTML,
  renderBatchThermalBarcodeLabelsHTML,
  renderA4BarcodeSheetHTML,
} from "@/lib/receipt-generator";
import { Barcode, Printer, X, Layers, Minus, Plus } from "lucide-react";

interface LabelEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleVariant?: ProductVariant | null;
  batchVariants?: ProductVariant[];
  stockMap?: Record<string, number>;
}

export function LabelEditorModal({
  isOpen,
  onClose,
  singleVariant,
  batchVariants,
  stockMap = {},
}: LabelEditorModalProps) {
  const { activeShop, openPrintModal } = useApp();

  const isBatch = Boolean(batchVariants && batchVariants.length > 0 && !singleVariant);
  const [format, setFormat] = useState<BarcodeLabelSize | "A4_SHEET">("50x30mm");
  const [singleCopies, setSingleCopies] = useState<number>(4);
  const [outletName, setOutletName] = useState(activeShop?.name || "Apex Footwear");

  // Batch copies state: variantId -> copies
  const [batchCopies, setBatchCopies] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (batchVariants) {
      batchVariants.forEach((v) => {
        init[v.id] = 2;
      });
    }
    return init;
  });

  if (!isOpen) return null;

  const previewVariant = singleVariant || (batchVariants && batchVariants[0]);

  const handlePrint = () => {
    const shop = outletName.trim() || activeShop?.name || "Apex Footwear";

    if (isBatch && batchVariants) {
      const items = batchVariants.map((v) => ({
        variant: v,
        copies: Math.max(1, batchCopies[v.id] || 1),
      }));
      const totalLabels = items.reduce((acc, it) => acc + it.copies, 0);

      let html = "";
      if (format === "A4_SHEET") {
        html = renderA4BarcodeSheetHTML(items, shop);
      } else {
        html = renderBatchThermalBarcodeLabelsHTML(items, shop, format as BarcodeLabelSize);
      }

      openPrintModal(`Batch Barcode Labels — ${batchVariants.length} SKUs (${totalLabels} labels)`, html);
    } else if (singleVariant) {
      const copies = Math.max(1, singleCopies);
      let html = "";
      if (format === "A4_SHEET") {
        html = renderA4BarcodeSheetHTML([{ variant: singleVariant, copies }], shop);
      } else {
        html = renderThermalBarcodeLabelHTML(singleVariant, copies, shop, format as BarcodeLabelSize);
      }

      openPrintModal(
        `Barcode Labels — ${singleVariant.sku} (${copies} ${copies === 1 ? "copy" : "copies"})`,
        html
      );
    }

    onClose();
  };

  const handleApplyPresetToAll = (count: number) => {
    if (!batchVariants) return;
    const next: Record<string, number> = {};
    batchVariants.forEach((v) => {
      next[v.id] = count;
    });
    setBatchCopies(next);
  };

  const handleApplyStockToAll = () => {
    if (!batchVariants) return;
    const next: Record<string, number> = {};
    batchVariants.forEach((v) => {
      next[v.id] = Math.max(1, stockMap[v.id] || 1);
    });
    setBatchCopies(next);
  };

  const totalBatchCopies = isBatch && batchVariants
    ? batchVariants.reduce((sum, v) => sum + Math.max(1, batchCopies[v.id] || 1), 0)
    : singleCopies;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-panel animate-fade-in"
        style={{
          maxWidth: isBatch ? "640px" : "500px",
          width: "100%",
          borderRadius: "20px",
          padding: "24px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexShrink: 0 }}>
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
              {isBatch ? <Layers size={22} /> : <Barcode size={22} />}
            </div>
            <div>
              <h3 style={{ fontSize: "19px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                {isBatch ? "Batch Barcode Label Editor" : "Barcode Label Editor"}
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                {isBatch
                  ? `Configure label layout & copies for ${batchVariants?.length} products`
                  : `${singleVariant?.productNameCache} (${singleVariant?.sku})`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
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

        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {/* Format Selector Pills */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
              Label Dimension / Format:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
              {[
                { id: "50x30mm", label: "50 × 30 mm", desc: "Standard Box" },
                { id: "50x25mm", label: "50 × 25 mm", desc: "Compact Roll" },
                { id: "40x30mm", label: "40 × 30 mm", desc: "Small Tag" },
                { id: "A4_SHEET", label: "A4 Sheet", desc: "24 Labels/Page" },
              ].map((opt) => {
                const isSelected = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id as any)}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: isSelected ? "var(--primary-soft)" : "var(--surface)",
                      color: isSelected ? "var(--primary-ink)" : "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: "800" }}>{opt.label}</div>
                    <div style={{ fontSize: "10px", color: isSelected ? "var(--primary-ink)" : "var(--ink-3)", marginTop: "2px" }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Sticker Preview (only for thermal formats) */}
          {format !== "A4_SHEET" && previewVariant && (
            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-2)" }}>
                  Live Preview ({format}):
                </span>
                <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                  Vector SVG &bull; Scaled to fit perfectly
                </span>
              </div>
              <div
                style={{
                  background: "#e8ecf2",
                  padding: "18px",
                  borderRadius: "14px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
                  minHeight: "130px",
                }}
                dangerouslySetInnerHTML={{
                  __html: renderSingleThermalBarcodeLabel(
                    previewVariant,
                    outletName || activeShop?.name || "Apex Footwear",
                    format as BarcodeLabelSize
                  ),
                }}
              />
            </div>
          )}

          {/* Outlet Name Customizer */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              Store Name on Header
            </label>
            <input
              type="text"
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
              className="input-field"
              placeholder="e.g. Apex Footwear - Main Branch"
              style={{ height: "40px", borderRadius: "10px", fontSize: "13px", width: "100%" }}
            />
          </div>

          {/* Copies Control: Single vs Batch */}
          {!isBatch && singleVariant && (
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Copies to Print
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setSingleCopies((prev) => Math.max(1, prev - 1))}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "36px", height: "36px", padding: 0, justifyContent: "center" }}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={singleCopies}
                    onChange={(e) => setSingleCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-field"
                    style={{ width: "70px", height: "36px", textAlign: "center", fontWeight: "700", borderRadius: "8px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setSingleCopies((prev) => prev + 1)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "36px", height: "36px", padding: 0, justifyContent: "center" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 4, 8, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSingleCopies(n)}
                      style={{
                        background: singleCopies === n ? "var(--primary)" : "var(--surface-sunken)",
                        color: singleCopies === n ? "#fff" : "var(--ink-2)",
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
            </div>
          )}

          {isBatch && batchVariants && (
            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                  Quantities per Product:
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetToAll(1)}
                    style={{ background: "var(--surface-sunken)", border: "1px solid var(--line)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    1 each
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetToAll(2)}
                    style={{ background: "var(--surface-sunken)", border: "1px solid var(--line)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    2 each
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyStockToAll}
                    style={{ background: "var(--primary-soft)", color: "var(--primary-ink)", border: "1px solid var(--primary-soft-line)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Match Stock
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "8px 12px",
                  background: "var(--surface-sunken)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {batchVariants.map((v) => {
                  const copies = batchCopies[v.id] || 2;
                  const onHand = stockMap[v.id] || 0;
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--surface)",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {v.productNameCache}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                          {v.brandNameCache} &bull; {v.colorNameCache} &bull; {v.sizeLabelCache} ({onHand} in stock)
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => setBatchCopies((prev) => ({ ...prev, [v.id]: Math.max(1, (prev[v.id] || 1) - 1) }))}
                          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={copies}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setBatchCopies((prev) => ({ ...prev, [v.id]: val }));
                          }}
                          style={{ width: "45px", height: "28px", textAlign: "center", fontWeight: "700", fontSize: "12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                        />
                        <button
                          type="button"
                          onClick={() => setBatchCopies((prev) => ({ ...prev, [v.id]: (prev[v.id] || 1) + 1 }))}
                          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid var(--line)", flexShrink: 0, marginTop: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink-2)" }}>
            Total: <span style={{ color: "var(--primary)", fontWeight: "800" }}>{totalBatchCopies} labels</span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-secondary"
              onClick={onClose}
              style={{ borderRadius: "12px", height: "42px", padding: "0 18px", fontWeight: "600" }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                borderRadius: "12px",
                height: "42px",
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
    </div>
  );
}
