// src/components/pos/UnknownBarcodeModal.tsx
"use client";

import React, { useState, useMemo } from "react";
import { ProductVariant } from "@/types";
import { getVariants, updateProductMaster } from "@/lib/firestore-service";
import { useApp } from "@/context/AppContext";
import { can } from "@/lib/permissions";
import { AlertTriangle, PlusCircle, Link2, X, Search, Check } from "lucide-react";

interface UnknownBarcodeModalProps {
  isOpen: boolean;
  barcode: string;
  onOpenQuickAdd: (prefilledBarcode: string) => void;
  onBarcodeLinked: (variant: ProductVariant) => void;
  onClose: () => void;
}

export function UnknownBarcodeModal({
  isOpen,
  barcode,
  onOpenQuickAdd,
  onBarcodeLinked,
  onClose,
}: UnknownBarcodeModalProps) {
  const { currentUser, refreshData } = useApp();
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLinkBarcode = can(currentUser, "products.set_barcode_unstocked");

  const allVariants = useMemo(() => getVariants(), []);
  const filteredVariants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allVariants.slice(0, 20);
    return allVariants
      .filter(
        (v) =>
          v.productNameCache.toLowerCase().includes(q) ||
          v.brandNameCache.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.colorNameCache.toLowerCase().includes(q) ||
          v.sizeLabelCache.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [allVariants, searchQuery]);

  if (!isOpen) return null;

  const handleLinkBarcode = async () => {
    if (!selectedVariantId || !currentUser) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const targetVariant = allVariants.find((v) => v.id === selectedVariantId);
      if (!targetVariant) throw new Error("Variant not found.");

      const updated = await updateProductMaster({
        productId: targetVariant.productId,
        variantId: targetVariant.id,
        barcode: barcode.trim(),
        user: currentUser,
      });

      refreshData();
      onBarcodeLinked(updated.variant);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to link barcode.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "var(--danger-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--danger)",
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                Unknown Barcode
              </h3>
              <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "2px" }}>
                No product found in catalogue
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

        {/* Barcode display pill */}
        <div
          style={{
            background: "var(--surface-sunken)",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "18px",
            border: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase" }}>
            Scanned Barcode
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)", fontFamily: "monospace", letterSpacing: "1px", marginTop: "2px" }}>
            {barcode}
          </div>
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
              marginBottom: "14px",
            }}
          >
            {error}
          </div>
        )}

        {!isLinkingMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onOpenQuickAdd(barcode);
                onClose();
              }}
              style={{
                height: "48px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: "700",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(32, 86, 200, 0.25)",
              }}
            >
              <PlusCircle size={18} />
              <span>Add as New Product</span>
            </button>

            {canLinkBarcode && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLinkingMode(true)}
                style={{
                  height: "46px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                }}
              >
                <Link2 size={16} />
                <span>Link to an Existing Product</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ height: "42px", borderRadius: "12px", marginTop: "6px" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0 10px", height: "38px" }}>
              <Search size={14} color="var(--ink-3)" />
              <input
                type="text"
                placeholder="Search variant by name, SKU…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", width: "100%" }}
              />
            </div>

            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "10px", padding: "4px" }}>
              {filteredVariants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: isSelected ? "var(--primary-soft)" : "transparent",
                      border: isSelected ? "1px solid var(--primary-soft-line)" : "none",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)" }}>{v.productNameCache}</div>
                      <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                        {v.brandNameCache} &bull; {v.colorNameCache} &bull; {v.sizeLabelCache} ({v.sku})
                      </div>
                    </div>
                    {isSelected && <Check size={16} color="var(--primary)" />}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsLinkingMode(false)}
                style={{ height: "38px", borderRadius: "8px" }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!selectedVariantId || isSubmitting}
                onClick={handleLinkBarcode}
                style={{ height: "38px", borderRadius: "8px", padding: "0 16px", fontWeight: "700" }}
              >
                {isSubmitting ? "Linking…" : "Link & Add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

