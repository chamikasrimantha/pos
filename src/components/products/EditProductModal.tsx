// src/components/products/EditProductModal.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Product, ProductVariant, ProductType } from "@/types";
import {
  getCategories,
  getBrands,
  getColors,
  getSizes,
  updateProductMaster,
} from "@/lib/firestore-service";
import { can } from "@/lib/permissions";
import { Edit3, X, AlertCircle, Lock, Save } from "lucide-react";

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variant: ProductVariant;
  onProductUpdated?: (updated: { product: Product; variant: ProductVariant }) => void;
}

export function EditProductModal({
  isOpen,
  onClose,
  product,
  variant,
  onProductUpdated,
}: EditProductModalProps) {
  const { currentUser, refreshData } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isShopManager = currentUser?.role === "SHOP_MANAGER";
  const isCashier = currentUser?.role === "CASHIER";

  // Section 2.3 permissions: Cashier cannot edit catalog
  const canEditAttributes = isSuperAdmin || isShopManager;
  const canEditCost = isSuperAdmin;
  const canEditSellingPrice = isSuperAdmin || isShopManager;

  const [productType, setProductType] = useState<ProductType>(product.productType || "FOOTWEAR");
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [brandId, setBrandId] = useState(product.brandId);
  const [colorId, setColorId] = useState(variant.colorId);
  const [sizeId, setSizeId] = useState(variant.sizeId);
  const [sku, setSku] = useState(variant.sku);
  const [barcode, setBarcode] = useState(variant.barcode);
  const [sellingPrice, setSellingPrice] = useState(String(variant.sellingPrice));
  const [referenceCostPrice, setReferenceCostPrice] = useState(String(variant.referenceCostPrice || 0));
  const [active, setActive] = useState(variant.active !== false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (isCashier) {
      setError("Cashiers are not permitted to modify catalogue products.");
      return;
    }

    const sellPrice = parseFloat(sellingPrice);
    if (isNaN(sellPrice) || sellPrice <= 0) {
      setError("Selling price must be greater than Rs. 0.00.");
      return;
    }

    const costPrice = parseFloat(referenceCostPrice) || 0;

    setIsSubmitting(true);
    try {
      const updated = await updateProductMaster({
        productId: product.id,
        variantId: variant.id,
        name: name.trim(),
        productType,
        categoryId,
        brandId,
        colorId,
        sizeId,
        sku: sku.trim(),
        barcode: barcode.trim(),
        sellingPrice: sellPrice,
        referenceCostPrice: canEditCost ? costPrice : undefined,
        active,
        user: currentUser,
      });

      refreshData();
      if (onProductUpdated) onProductUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update product.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Edit3 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "19px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                Edit Product Master
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                {isCashier ? (
                  <span style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Lock size={12} /> View only &bull; Cashiers cannot edit catalog
                  </span>
                ) : isShopManager ? (
                  <span>Manager access &bull; Cost price locked</span>
                ) : (
                  <span>Super Admin full catalogue access</span>
                )}
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
          {/* Product Type */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              Product Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                disabled={!canEditAttributes}
                onClick={() => setProductType("FOOTWEAR")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: productType === "FOOTWEAR" ? "2px solid var(--primary)" : "1px solid var(--line)",
                  background: productType === "FOOTWEAR" ? "var(--primary-soft)" : "var(--surface)",
                  color: productType === "FOOTWEAR" ? "var(--primary-ink)" : "var(--ink)",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: canEditAttributes ? "pointer" : "not-allowed",
                  opacity: canEditAttributes ? 1 : 0.7,
                }}
              >
                👟 Footwear
              </button>
              <button
                type="button"
                disabled={!canEditAttributes}
                onClick={() => setProductType("BAG")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: productType === "BAG" ? "2px solid var(--primary)" : "1px solid var(--line)",
                  background: productType === "BAG" ? "var(--primary-soft)" : "var(--surface)",
                  color: productType === "BAG" ? "var(--primary-ink)" : "var(--ink)",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: canEditAttributes ? "pointer" : "not-allowed",
                  opacity: canEditAttributes ? 1 : 0.7,
                }}
              >
                🎒 Bags & Travel
              </button>
            </div>
          </div>

          {/* Product Name */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              Product Name {!canEditAttributes && <Lock size={11} style={{ marginLeft: "4px" }} />}
            </label>
            <input
              type="text"
              value={name}
              disabled={!canEditAttributes}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "14px" }}
            />
          </div>

          {/* Category & Brand */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Category
              </label>
              <select
                value={categoryId}
                disabled={!canEditAttributes}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Brand
              </label>
              <select
                value={brandId}
                disabled={!canEditAttributes}
                onChange={(e) => setBrandId(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color & Size */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Colour
              </label>
              <select
                value={colorId}
                disabled={!canEditAttributes}
                onChange={(e) => setColorId(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {allColors.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Size
              </label>
              <select
                value={sizeId}
                disabled={!canEditAttributes}
                onChange={(e) => setSizeId(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px" }}
              >
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing Row: Selling Price & Cost Price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Selling Price (Rs.) {!canEditSellingPrice && <Lock size={11} />}
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={sellingPrice}
                disabled={!canEditSellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "14px", fontWeight: "700" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Cost Price (Rs.) {!canEditCost && <Lock size={11} />}
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={canEditCost ? referenceCostPrice : "•••"}
                disabled={!canEditCost}
                onChange={(e) => setReferenceCostPrice(e.target.value)}
                className="input-field"
                style={{
                  height: "40px",
                  borderRadius: "10px",
                  width: "100%",
                  fontSize: "14px",
                  background: !canEditCost ? "var(--surface-sunken)" : "var(--surface)",
                  cursor: !canEditCost ? "not-allowed" : "text",
                }}
              />
              {!canEditCost && (
                <div style={{ fontSize: "10px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Super Admin access required to modify cost
                </div>
              )}
            </div>
          </div>

          {/* Barcode & SKU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Barcode {!canEditAttributes && <Lock size={11} />}
              </label>
              <input
                type="text"
                value={barcode}
                disabled={!canEditAttributes}
                onChange={(e) => setBarcode(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                SKU {!canEditAttributes && <Lock size={11} />}
              </label>
              <input
                type="text"
                value={sku}
                disabled={!canEditAttributes}
                onChange={(e) => setSku(e.target.value)}
                className="input-field"
                style={{ height: "40px", borderRadius: "10px", width: "100%", fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>
          </div>

          {/* Active Status */}
          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="activeCheckbox"
              checked={active}
              disabled={!canEditAttributes}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
            />
            <label htmlFor="activeCheckbox" style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", cursor: "pointer" }}>
              Active (available in POS counter)
            </label>
          </div>

          {/* Footer Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ borderRadius: "12px", height: "42px", padding: "0 18px", fontWeight: "600" }}
            >
              {isCashier ? "Close" : "Cancel"}
            </button>
            {!isCashier && (
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
                <Save size={16} />
                <span>{isSubmitting ? "Saving…" : "Save Changes"}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
