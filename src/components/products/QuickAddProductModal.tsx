// src/components/products/QuickAddProductModal.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { ProductType, Product, ProductVariant } from "@/types";
import {
  getCategories,
  getBrands,
  getColors,
  getSizes,
  createQuickProduct,
  generateEan13Barcode,
} from "@/lib/firestore-service";
import { can } from "@/lib/permissions";
import { PlusCircle, X, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated?: (created: { product: Product; variant: ProductVariant }) => void;
  initialProductType?: ProductType;
  initialBarcode?: string;
  showCostField?: boolean;
}

export function QuickAddProductModal({
  isOpen,
  onClose,
  onProductCreated,
  initialProductType = "FOOTWEAR",
  initialBarcode,
  showCostField = false,
}: QuickAddProductModalProps) {
  const { currentUser, activeShop, refreshData } = useApp();

  const [productType, setProductType] = useState<ProductType>(initialProductType);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [referenceCostPrice, setReferenceCostPrice] = useState("");
  const [startingQuantity, setStartingQuantity] = useState("0");
  const [barcode, setBarcode] = useState(initialBarcode || "");
  const [sku, setSku] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditCost = showCostField || currentUser?.role === "SUPER_ADMIN";

  // Filter master lists by productType
  const allCategories = useMemo(() => getCategories(), []);
  const allBrands = useMemo(() => getBrands(), []);
  const allColors = useMemo(() => getColors(), []);
  const allSizes = useMemo(() => getSizes(), []);

  const categories = useMemo(() => {
    return allCategories.filter((c) => !c.productType || c.productType === productType);
  }, [allCategories, productType]);

  const brands = useMemo(() => {
    return allBrands.filter((b) => !b.productType || b.productType === "BOTH" || b.productType === productType);
  }, [allBrands, productType]);

  const sizes = useMemo(() => {
    return allSizes.filter((s) => !s.productType || s.productType === productType);
  }, [allSizes, productType]);

  // Reset category/size when product type changes if current selection is invalid
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (brands.length > 0 && !brands.some((b) => b.id === brandId)) {
      setBrandId(brands[0].id);
    }
  }, [brands, brandId]);

  useEffect(() => {
    if (sizes.length > 0 && !sizes.some((s) => s.id === sizeId)) {
      setSizeId(sizes[0].id);
    }
  }, [sizes, sizeId]);

  useEffect(() => {
    if (allColors.length > 0 && !colorId) {
      setColorId(allColors[0].id);
    }
  }, [allColors, colorId]);

  // Handle auto-generation of barcode
  const handleGenerateBarcode = () => {
    const ean = generateEan13Barcode();
    setBarcode(ean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!brandId) {
      setError("Please select a brand.");
      return;
    }
    if (!colorId) {
      setError("Please select a color.");
      return;
    }
    if (!sizeId) {
      setError("Please select a size.");
      return;
    }
    const sellPrice = parseFloat(sellingPrice);
    if (isNaN(sellPrice) || sellPrice <= 0) {
      setError("Selling price must be greater than Rs. 0.00.");
      return;
    }

    const costPrice = canEditCost && referenceCostPrice ? parseFloat(referenceCostPrice) : 0;
    const startQty = parseInt(startingQuantity) || 0;

    setIsSubmitting(true);
    try {
      const result = await createQuickProduct({
        productType,
        name: name.trim(),
        categoryId,
        brandId,
        colorId,
        sizeId,
        sellingPrice: sellPrice,
        referenceCostPrice: isNaN(costPrice) ? 0 : costPrice,
        startingQuantity: startQty,
        shopId: activeShop.id,
        createdBy: currentUser?.uid || "cashier",
        barcode: barcode.trim() || undefined,
        sku: sku.trim() || undefined,
      });

      refreshData();
      if (onProductCreated) {
        onProductCreated(result);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-panel animate-fade-in"
        style={{
          maxWidth: "560px",
          width: "100%",
          borderRadius: "20px",
          padding: "24px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
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
              <PlusCircle size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "19px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                Quick Add Product
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                Fast creation at counter &bull; flags for review
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
              marginBottom: "14px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {/* Requirement P1: Product Type Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: "800", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
              PRODUCT TYPE <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setProductType("FOOTWEAR")}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: productType === "FOOTWEAR" ? "2px solid var(--primary)" : "1px solid var(--line)",
                  background: productType === "FOOTWEAR" ? "var(--primary-soft)" : "var(--surface)",
                  color: productType === "FOOTWEAR" ? "var(--primary-ink)" : "var(--ink)",
                  fontWeight: "800",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span>👟 Footwear</span>
              </button>
              <button
                type="button"
                onClick={() => setProductType("BAG")}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: productType === "BAG" ? "2px solid var(--primary)" : "1px solid var(--line)",
                  background: productType === "BAG" ? "var(--primary-soft)" : "var(--surface)",
                  color: productType === "BAG" ? "var(--primary-ink)" : "var(--ink)",
                  fontWeight: "800",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span>🎒 Bags & Travel</span>
              </button>
            </div>
          </div>

          {/* Product Name */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              Product Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder={productType === "FOOTWEAR" ? "e.g. Mens Leather Oxford Classic" : "e.g. Travel Duffle Bag 50L"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
              style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "14px" }}
            />
          </div>

          {/* Category & Brand (filtered by productType) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Category <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Brand <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color & Size (filtered by productType) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Colour <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {allColors.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Size <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing Row */}
          <div style={{ display: "grid", gridTemplateColumns: canEditCost ? "1fr 1fr" : "1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Selling Price (Rs.) <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="number"
                step="10"
                min="0"
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="input-field"
                required
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "14px", fontWeight: "700" }}
              />
            </div>

            {canEditCost && (
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Cost Price (Rs.) <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>(Admin only)</span>
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="0.00"
                  value={referenceCostPrice}
                  onChange={(e) => setReferenceCostPrice(e.target.value)}
                  className="input-field"
                  style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "14px" }}
                />
              </div>
            )}
          </div>

          {/* Starting Stock Quantity */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              Starting Stock in {activeShop.name} (optional)
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={startingQuantity}
              onChange={(e) => setStartingQuantity(e.target.value)}
              className="input-field"
              style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "14px" }}
            />
            <div style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "3px" }}>
              If greater than 0, inventory is automatically added for this outlet.
            </div>
          </div>

          {/* Barcode & SKU Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                  Barcode
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <Sparkles size={11} /> Auto EAN-13
                </button>
              </div>
              <input
                type="text"
                placeholder="Leave blank to auto-generate"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Custom SKU (optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if empty"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="input-field"
                style={{ height: "42px", borderRadius: "10px", width: "100%", fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ borderRadius: "12px", height: "42px", padding: "0 18px", fontWeight: "600" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
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
              <PlusCircle size={16} />
              <span>{isSubmitting ? "Creating…" : "Create Product"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
