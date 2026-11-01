// src/components/pos/LinePriceEditorModal.tsx
"use client";

import React, { useState } from "react";
import { ProductVariant } from "@/types";
import { formatCurrency } from "@/lib/receipt-generator";
import { Edit3, X, Tag, AlertCircle, Check } from "lucide-react";

export interface LinePriceEditorResult {
  variantId: string;
  originalUnitPrice: number;
  newLines: { price: number; quantity: number; reason?: string }[];
}

interface LinePriceEditorModalProps {
  isOpen: boolean;
  variant: ProductVariant;
  currentQuantity: number;
  currentUnitPrice: number;
  onApply: (result: LinePriceEditorResult) => void;
  onClose: () => void;
}

export function LinePriceEditorModal({
  isOpen,
  variant,
  currentQuantity,
  currentUnitPrice,
  onApply,
  onClose,
}: LinePriceEditorModalProps) {
  const cataloguePrice = variant.sellingPrice;

  const [isDifferentMode, setIsDifferentMode] = useState(false);
  const [singlePrice, setSinglePrice] = useState(String(currentUnitPrice));
  const [pairPrices, setPairPrices] = useState<string[]>(
    Array.from({ length: currentQuantity }, () => String(currentUnitPrice))
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isDifferentMode) {
      const p = parseFloat(singlePrice);
      if (isNaN(p) || p <= 0) {
        setError("Price must be greater than Rs. 0.00.");
        return;
      }
      onApply({
        variantId: variant.id,
        originalUnitPrice: currentUnitPrice,
        newLines: [{ price: p, quantity: currentQuantity, reason: reason.trim() || undefined }],
      });
      onClose();
    } else {
      const validPrices: number[] = [];
      for (let i = 0; i < currentQuantity; i++) {
        const p = parseFloat(pairPrices[i]);
        if (isNaN(p) || p <= 0) {
          setError(`Item #${i + 1} must have a valid price greater than Rs. 0.00.`);
          return;
        }
        validPrices.push(p);
      }

      // Merge identical prices into one line with quantity (Acceptance X4)
      const priceCounts: Record<number, number> = {};
      validPrices.forEach((p) => {
        priceCounts[p] = (priceCounts[p] || 0) + 1;
      });

      const grouped = Object.entries(priceCounts).map(([priceStr, qty]) => ({
        price: parseFloat(priceStr),
        quantity: qty,
        reason: reason.trim() || undefined,
      }));

      onApply({
        variantId: variant.id,
        originalUnitPrice: currentUnitPrice,
        newLines: grouped,
      });
      onClose();
    }
  };

  const totalCharged = !isDifferentMode
    ? (parseFloat(singlePrice) || 0) * currentQuantity
    : pairPrices.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);

  const catalogueTotal = cataloguePrice * currentQuantity;
  const difference = totalCharged - catalogueTotal;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-panel animate-fade-in"
        style={{
          maxWidth: "480px",
          width: "100%",
          borderRadius: "20px",
          padding: "24px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexShrink: 0 }}>
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
              <Edit3 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                Edit Cart Line Price
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                {variant.productNameCache} ({variant.sizeLabelCache}) &bull; Qty: {currentQuantity}
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

        {error && (
          <div
            style={{
              background: "var(--danger-soft)",
              border: "1px solid var(--danger-soft-line)",
              color: "var(--danger)",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Catalogue Fixed Price Badge */}
        <div
          style={{
            background: "var(--surface-sunken)",
            borderRadius: "12px",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink-2)", fontWeight: "600" }}>
            <Tag size={14} color="var(--primary)" />
            <span>Catalogue List Price:</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--ink)" }}>
            {formatCurrency(cataloguePrice)}
          </div>
        </div>

        <form onSubmit={handleApply} style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {/* Switch if Qty > 1 */}
          {currentQuantity > 1 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsDifferentMode(false)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: !isDifferentMode ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: !isDifferentMode ? "var(--primary-soft)" : "var(--surface)",
                    color: !isDifferentMode ? "var(--primary-ink)" : "var(--ink)",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Same price for all {currentQuantity}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDifferentMode(true)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: isDifferentMode ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: isDifferentMode ? "var(--primary-soft)" : "var(--surface)",
                    color: isDifferentMode ? "var(--primary-ink)" : "var(--ink)",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Different price per pair
                </button>
              </div>
            </div>
          )}

          {/* Single Price Input */}
          {!isDifferentMode && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Selling Price per Pair (Rs.)
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={singlePrice}
                autoFocus
                onChange={(e) => setSinglePrice(e.target.value)}
                className="input-field"
                style={{ height: "46px", borderRadius: "12px", fontSize: "17px", fontWeight: "800", width: "100%" }}
              />
            </div>
          )}

          {/* Different Price Per Pair */}
          {isDifferentMode && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Set Individual Price for Each Pair:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                {Array.from({ length: currentQuantity }).map((_, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink-2)", width: "65px" }}>
                      Pair #{idx + 1}:
                    </span>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={pairPrices[idx] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPairPrices((prev) => {
                          const next = [...prev];
                          next[idx] = val;
                          return next;
                        });
                      }}
                      className="input-field"
                      style={{ height: "40px", borderRadius: "8px", fontSize: "15px", fontWeight: "700", flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
              Override Reason (optional)
            </label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              {["Negotiated", "Damaged Box", "Staff Discount", "Customer Promotion"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  style={{
                    background: reason === r ? "var(--primary-soft)" : "var(--surface-sunken)",
                    color: reason === r ? "var(--primary-ink)" : "var(--ink-2)",
                    border: reason === r ? "1px solid var(--primary-soft-line)" : "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="e.g. Approved price adjustment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field"
              style={{ height: "36px", borderRadius: "8px", fontSize: "13px", width: "100%" }}
            />
          </div>

          {/* Live Subtotal & Difference */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: difference !== 0 ? "#fef3c7" : "var(--surface-sunken)",
              border: difference !== 0 ? "1px solid #fde68a" : "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)" }}>
                Total Line Amount: {formatCurrency(totalCharged)}
              </div>
              {difference !== 0 && (
                <div style={{ fontSize: "11px", fontWeight: "700", color: difference < 0 ? "#b45309" : "var(--success)" }}>
                  {difference < 0
                    ? `Discount of ${formatCurrency(Math.abs(difference))} vs Catalogue`
                    : `Premium of ${formatCurrency(difference)} vs Catalogue`}
                </div>
              )}
            </div>
            {difference !== 0 && (
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#92400e", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                Overridden
              </span>
            )}
          </div>

          {/* Footer Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ borderRadius: "12px", height: "42px", padding: "0 18px", fontWeight: "600" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
              <Check size={16} />
              <span>Apply Price</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

