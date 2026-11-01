// src/components/pos/ScanPriceDialog.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { ProductVariant } from "@/types";
import { formatCurrency } from "@/lib/receipt-generator";
import { Plus, Minus, Tag, X, Layers, AlertCircle, ShoppingCart } from "lucide-react";

export interface ScanPriceDialogItem {
  variant: ProductVariant;
  quantity: number;
  prices: number[]; // Length equals quantity. If same price, all identical.
  isDifferentPerPair: boolean;
  reason?: string;
}

interface ScanPriceDialogProps {
  isOpen: boolean;
  item: ScanPriceDialogItem | null;
  onConfirm: (result: {
    variant: ProductVariant;
    quantitiesAndPrices: { price: number; quantity: number; reason?: string }[];
  }) => void;
  onCancel: () => void;
  onIncrementQuantity: () => void;
  onDecrementQuantity: () => void;
  stockOnHand: number;
  queueCount?: number;
}

export function ScanPriceDialog({
  isOpen,
  item,
  onConfirm,
  onCancel,
  onIncrementQuantity,
  onDecrementQuantity,
  stockOnHand,
  queueCount = 0,
}: ScanPriceDialogProps) {
  const [isDifferentMode, setIsDifferentMode] = useState(false);
  const [singlePrice, setSinglePrice] = useState("");
  const [pairPrices, setPairPrices] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const priceInputRef = useRef<HTMLInputElement>(null);

  // When a new item or quantity is passed in
  useEffect(() => {
    if (!item) return;

    const cataloguePrice = String(item.variant.sellingPrice);
    setSinglePrice(cataloguePrice);
    setIsDifferentMode(false);
    setError(null);
    setReason("");

    // Initialize individual pair prices to catalogue price
    const initialPairs = Array.from({ length: item.quantity }, () => cataloguePrice);
    setPairPrices(initialPairs);

    // Auto-focus and select the price field immediately
    const timer = setTimeout(() => {
      if (priceInputRef.current) {
        priceInputRef.current.focus();
        priceInputRef.current.select();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [item?.variant.id]);

  // Sync pairPrices array length when item.quantity changes (e.g. from rapid scans)
  useEffect(() => {
    if (!item) return;
    setPairPrices((prev) => {
      const targetLength = item.quantity;
      if (prev.length === targetLength) return prev;
      const next = [...prev];
      while (next.length < targetLength) {
        next.push(singlePrice || String(item.variant.sellingPrice));
      }
      return next.slice(0, targetLength);
    });
  }, [item?.quantity]);

  if (!isOpen || !item) return null;

  const { variant, quantity } = item;
  const cataloguePrice = variant.sellingPrice;

  // Handle keyboard shortcuts: Enter confirms, Escape cancels
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleConfirm = () => {
    setError(null);

    if (!isDifferentMode) {
      const p = parseFloat(singlePrice);
      if (isNaN(p) || p <= 0) {
        setError("Price must be a valid amount greater than Rs. 0.00.");
        return;
      }
      onConfirm({
        variant,
        quantitiesAndPrices: [{ price: p, quantity, reason: reason.trim() || undefined }],
      });
    } else {
      // Validate all individual pair prices
      const validPrices: number[] = [];
      for (let i = 0; i < quantity; i++) {
        const p = parseFloat(pairPrices[i]);
        if (isNaN(p) || p <= 0) {
          setError(`Item #${i + 1} must have a valid price greater than Rs. 0.00.`);
          return;
        }
        validPrices.push(p);
      }

      // Group identical prices together (Acceptance X4)
      const priceCounts: Record<number, number> = {};
      validPrices.forEach((p) => {
        priceCounts[p] = (priceCounts[p] || 0) + 1;
      });

      const grouped = Object.entries(priceCounts).map(([priceStr, qty]) => ({
        price: parseFloat(priceStr),
        quantity: qty,
        reason: reason.trim() || undefined,
      }));

      onConfirm({
        variant,
        quantitiesAndPrices: grouped,
      });
    }
  };

  // Live total calculation
  const totalCharged = !isDifferentMode
    ? (parseFloat(singlePrice) || 0) * quantity
    : pairPrices.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);

  const catalogueTotal = cataloguePrice * quantity;
  const difference = totalCharged - catalogueTotal;

  return (
    <div className="modal-backdrop" onKeyDown={handleKeyDown}>
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  color: "var(--primary-ink)",
                  background: "var(--primary-soft)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                {variant.brandNameCache}
              </span>
              {queueCount > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "#fff",
                    background: "var(--primary)",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                  }}
                >
                  +{queueCount} more waiting
                </span>
              )}
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: "4px 0 2px" }}>
              {variant.productNameCache}
            </h3>
            <div style={{ fontSize: "13px", color: "var(--ink-2)" }}>
              {variant.colorNameCache} &bull; <strong style={{ color: "var(--ink)" }}>{variant.sizeLabelCache}</strong>
              <span style={{ margin: "0 6px" }}>&bull;</span>
              <span style={{ color: stockOnHand > 0 ? "var(--success)" : "var(--danger)", fontWeight: "600" }}>
                {stockOnHand} in stock
              </span>
            </div>
          </div>

          <button
            onClick={onCancel}
            tabIndex={-1}
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

        {/* Fixed Catalogue Price Banner */}
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

        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {/* Quantity Stepper */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
              Quantity to Add:
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onDecrementQuantity}
                  disabled={quantity <= 1}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "40px", height: "40px", padding: 0, justifyContent: "center" }}
                >
                  <Minus size={16} />
                </button>
                <div
                  style={{
                    width: "60px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "800",
                    fontSize: "16px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                  }}
                >
                  {quantity}
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onIncrementQuantity}
                  disabled={quantity >= stockOnHand}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "40px", height: "40px", padding: 0, justifyContent: "center" }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {quantity > stockOnHand && (
                <span style={{ fontSize: "12px", color: "var(--danger)", fontWeight: "600" }}>
                  Exceeds current stock!
                </span>
              )}
            </div>
          </div>

          {/* Toggle for Quantity > 1: Same vs Different price */}
          {quantity > 1 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  tabIndex={-1}
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
                  Same price for all {quantity}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
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
                  Different price per item
                </button>
              </div>
            </div>
          )}

          {/* Single Price Input Mode */}
          {!isDifferentMode && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Selling Price per Pair (Rs.)
              </label>
              <input
                ref={priceInputRef}
                type="number"
                step="10"
                min="0"
                value={singlePrice}
                onChange={(e) => setSinglePrice(e.target.value)}
                className="input-field"
                style={{
                  height: "48px",
                  borderRadius: "12px",
                  fontSize: "18px",
                  fontWeight: "800",
                  width: "100%",
                }}
              />
              <div style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "4px" }}>
                Press <strong>Enter</strong> to accept and add to sale. Type over to change price.
              </div>
            </div>
          )}

          {/* Different Price Per Item Mode */}
          {isDifferentMode && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Set Individual Price for Each Item:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                {Array.from({ length: quantity }).map((_, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink-2)", width: "65px" }}>
                      Item #{idx + 1}:
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

          {/* Reason Input (Optional) */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
              Override Reason (optional)
            </label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              {["Negotiated", "Damaged Box", "Staff Discount", "Customer Promotion"].map((r) => (
                <button
                  key={r}
                  type="button"
                  tabIndex={-1}
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
              placeholder="e.g. Cleared with store manager"
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
              marginBottom: "8px",
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
                Price Overridden
              </span>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ borderRadius: "12px", height: "44px", padding: "0 18px", fontWeight: "600" }}
          >
            Cancel (Esc)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            style={{
              borderRadius: "12px",
              height: "44px",
              padding: "0 24px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(32, 86, 200, 0.3)",
            }}
          >
            <ShoppingCart size={16} />
            <span>Add to Sale (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

