// src/components/products/ProductsMasterView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getProducts,
  getVariants,
  getCategories,
  getBrands,
  getColors,
  getSizes,
  getInventoryForShop,
} from "@/lib/firestore-service";
import { formatCurrency } from "@/lib/receipt-generator";
import { Product, ProductVariant, ProductType } from "@/types";
import { can } from "@/lib/permissions";
import {
  Tag,
  Barcode,
  Printer,
  Search,
  X,
  Layers,
  Sparkles,
  PlusCircle,
  Edit3,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { QuickAddProductModal } from "./QuickAddProductModal";
import { EditProductModal } from "./EditProductModal";
import { LabelEditorModal } from "./LabelEditorModal";

export function ProductsMasterView() {
  const { currentUser, activeShop, dataVersion } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"ALL" | ProductType>("ALL");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ product: Product; variant: ProductVariant } | null>(null);

  // Label editor modal state
  const [labelEditorSingleVariant, setLabelEditorSingleVariant] = useState<ProductVariant | null>(null);
  const [isLabelEditorBatchOpen, setIsLabelEditorBatchOpen] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  const canSeeCost = currentUser?.role === "SUPER_ADMIN";
  const canPrintLabels = can(currentUser, "products.print_labels");
  const canQuickAdd = can(currentUser, "products.quick_add");

  const products = useMemo(() => getProducts(), [dataVersion]);
  const variants = useMemo(() => getVariants(), [dataVersion]);
  const categories = useMemo(() => getCategories(), [dataVersion]);
  const brands = useMemo(() => getBrands(), [dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);

  // Product map: productId -> Product
  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // Inventory quantity map: variantId -> qty
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryList.forEach((inv) => {
      map[inv.variantId] = inv.quantityOnHand;
    });
    return map;
  }, [inventoryList]);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    let list = variants;

    // Filter by product type
    if (selectedTypeFilter !== "ALL") {
      list = list.filter((v) => (v.productType || "FOOTWEAR") === selectedTypeFilter);
    }

    // Filter by brand
    if (selectedBrandFilter !== "ALL") {
      list = list.filter((v) => v.brandNameCache === selectedBrandFilter);
    }

    // Filter by category
    if (selectedCategoryFilter !== "ALL") {
      list = list.filter((v) => {
        const prod = productMap[v.productId];
        return prod?.categoryId === selectedCategoryFilter;
      });
    }

    // Filter by search query
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
  }, [variants, selectedTypeFilter, selectedBrandFilter, selectedCategoryFilter, searchQuery, productMap]);

  // Toggle variant selection for batch printing
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

  // Open edit modal for a variant
  const handleOpenEdit = (variant: ProductVariant) => {
    const product = productMap[variant.productId] || {
      id: variant.productId,
      name: variant.productNameCache,
      brandId: "",
      categoryId: "",
      active: variant.active,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "system",
    };
    setEditingItem({ product, variant });
  };

  const selectedBatchVariants = useMemo(() => {
    return variants.filter((v) => selectedVariantIds.has(v.id));
  }, [variants, selectedVariantIds]);

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
      {/* Header and Controls */}
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
              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", margin: 0, letterSpacing: "-0.3px" }}>
                Product Catalogue & Barcodes
              </h1>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                Footwear & Bag models, quick creation, vector thermal labels (50×30, 50×25, 40×30mm)
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "9999px",
              padding: "0 14px",
              height: "42px",
              minWidth: "220px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <Search size={16} color="var(--ink-3)" style={{ marginRight: "8px", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search product, barcode, SKU…"
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

          {/* Quick Add Product Button */}
          {canQuickAdd && (
            <button
              className="btn btn-primary"
              onClick={() => setIsQuickAddOpen(true)}
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
              <PlusCircle size={16} />
              <span>Quick Add Product</span>
            </button>
          )}

          {/* Batch Print Button - strictly hidden from Super Admin */}
          {canPrintLabels && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (selectedVariantIds.size === 0) {
                  setSelectedVariantIds(new Set(filteredVariants.map((v) => v.id)));
                }
                setIsLabelEditorBatchOpen(true);
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
              }}
            >
              <Printer size={16} />
              <span>Batch Print Labels</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row: Product Type Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", marginRight: "4px" }}>
          Type:
        </span>
        {[
          { id: "ALL", label: `All Types (${variants.length})` },
          { id: "FOOTWEAR", label: `Footwear (${variants.filter((v) => (v.productType || "FOOTWEAR") === "FOOTWEAR").length})` },
          { id: "BAG", label: `Bags & Travel (${variants.filter((v) => v.productType === "BAG").length})` },
        ].map((t) => {
          const isSelected = selectedTypeFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTypeFilter(t.id as any)}
              style={{
                borderRadius: "9999px",
                padding: "0 14px",
                height: "34px",
                fontSize: "13px",
                fontWeight: "700",
                border: isSelected ? "1px solid var(--primary)" : "1px solid var(--line)",
                background: isSelected ? "var(--primary)" : "var(--surface)",
                color: isSelected ? "#ffffff" : "var(--ink)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Brand & Category Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          padding: "4px 0",
          scrollbarWidth: "none",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", marginRight: "4px" }}>
          Brand:
        </span>
        <button
          onClick={() => setSelectedBrandFilter("ALL")}
          style={{
            borderRadius: "9999px",
            padding: "0 12px",
            height: "30px",
            fontSize: "12px",
            fontWeight: "700",
            border: selectedBrandFilter === "ALL" ? "1px solid var(--primary)" : "1px solid var(--line)",
            background: selectedBrandFilter === "ALL" ? "var(--primary-soft)" : "var(--surface)",
            color: selectedBrandFilter === "ALL" ? "var(--primary-ink)" : "var(--ink-2)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          All Brands
        </button>
        {brands
          .filter((b) => selectedTypeFilter === "ALL" || !b.productType || b.productType === "BOTH" || b.productType === selectedTypeFilter)
          .map((b) => {
            const isSelected = selectedBrandFilter === b.name;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBrandFilter(b.name)}
                style={{
                  borderRadius: "9999px",
                  padding: "0 12px",
                  height: "30px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: isSelected ? "1px solid var(--primary)" : "1px solid var(--line)",
                  background: isSelected ? "var(--primary-soft)" : "var(--surface)",
                  color: isSelected ? "var(--primary-ink)" : "var(--ink-2)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {b.name}
              </button>
            );
          })}
      </div>

      {/* KPI Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          flexShrink: 0,
        }}
      >
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase" }}>
            Catalogue Models
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", marginTop: "2px" }}>
            {products.length}
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase" }}>
            Active SKUs
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", marginTop: "2px" }}>
            {variants.length}
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "700", textTransform: "uppercase" }}>
            In-Stock Pairs & Bags ({activeShop.name})
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--primary)", marginTop: "2px" }}>
            {Object.values(stockMap).reduce((a, b) => a + b, 0)}
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="desktop-only-table pos-table-container">
        <div className="pos-table-scroll">
          <table className="pos-table" style={{ width: "100%", tableLayout: "auto" }}>
            <thead>
              <tr>
                {canPrintLabels && (
                  <th style={{ width: "38px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedVariantIds.size > 0 && selectedVariantIds.size === filteredVariants.length}
                      onChange={handleSelectAllFiltered}
                      style={{ cursor: "pointer", accentColor: "var(--primary)" }}
                    />
                  </th>
                )}
                <th>Type</th>
                <th>Product & Brand</th>
                <th>Color & Size</th>
                <th>SKU & Barcode</th>
                <th className="num">Stock ({activeShop.name})</th>
                {canSeeCost && <th className="num">Cost</th>}
                <th className="num">Selling Price</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan={canSeeCost ? (canPrintLabels ? 10 : 9) : (canPrintLabels ? 9 : 8)} style={{ textAlign: "center", padding: "36px", color: "var(--ink-3)" }}>
                    No products match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredVariants.map((v) => {
                  const isChecked = selectedVariantIds.has(v.id);
                  const qoh = stockMap[v.id] || 0;
                  const isLow = qoh > 0 && qoh <= 3;
                  const isOut = qoh <= 0;
                  const prod = productMap[v.productId];
                  const reviewStatus = v.reviewStatus || prod?.reviewStatus || "APPROVED";
                  const isBag = v.productType === "BAG" || prod?.productType === "BAG";

                  return (
                    <tr key={v.id} style={{ background: isChecked ? "var(--primary-soft)" : undefined }}>
                      {canPrintLabels && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleVariantSelection(v.id)}
                            style={{ cursor: "pointer", accentColor: "var(--primary)" }}
                          />
                        </td>
                      )}
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: isBag ? "#ede9fe" : "#e0f2fe",
                            color: isBag ? "#6b21a8" : "#0369a1",
                          }}
                        >
                          {isBag ? "BAG" : "FOOTWEAR"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: "700", color: "var(--ink)" }}>{v.productNameCache}</div>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{v.brandNameCache}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: "13px", color: "var(--ink)" }}>{v.colorNameCache}</div>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-2)" }}>{v.sizeLabelCache}</div>
                      </td>
                      <td>
                        <div style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: "var(--ink)" }}>{v.sku}</div>
                        <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--ink-3)" }}>{v.barcode}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontWeight: "700",
                            color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--success)",
                          }}
                        >
                          {qoh} in stock
                        </span>
                      </td>
                      {canSeeCost && (
                        <td style={{ textAlign: "right", fontFamily: "tabular-nums", color: "var(--ink-2)" }}>
                          {formatCurrency(v.referenceCostPrice || 0)}
                        </td>
                      )}
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "tabular-nums", color: "var(--ink)" }}>
                        {formatCurrency(v.sellingPrice)}
                      </td>
                      <td>
                        {reviewStatus === "NEEDS_REVIEW" ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#b45309",
                              background: "#fef3c7",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Clock size={11} /> Needs Review
                          </span>
                        ) : reviewStatus === "REJECTED" ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "var(--danger)",
                              background: "var(--danger-soft)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <AlertTriangle size={11} /> Rejected
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "var(--success)",
                              background: "var(--success-soft)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <CheckCircle size={11} /> Approved
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(v)}
                            title="Edit product"
                            style={{ height: "32px", padding: "0 10px", borderRadius: "8px" }}
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                          {canPrintLabels && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setLabelEditorSingleVariant(v)}
                              title="Print barcode label"
                              style={{ height: "32px", padding: "0 10px", borderRadius: "8px" }}
                            >
                              <Printer size={13} style={{ color: "var(--primary)" }} />
                              <span>Label</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Responsive Cards (<768px) */}
      <div className="mobile-only-cards" style={{ display: "none", flexDirection: "column", gap: "10px" }}>
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
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-ink)", background: "var(--primary-soft)", padding: "1px 6px", borderRadius: "6px" }}>
                      {v.brandNameCache}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: v.productType === "BAG" ? "#6b21a8" : "#0369a1", background: v.productType === "BAG" ? "#ede9fe" : "#e0f2fe", padding: "1px 6px", borderRadius: "6px" }}>
                      {v.productType === "BAG" ? "BAG" : "FOOTWEAR"}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)", margin: "4px 0 2px" }}>
                    {v.productNameCache}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                    {v.colorNameCache} &bull; <strong>{v.sizeLabelCache}</strong>
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--ink-3)" }}>
                  {v.barcode}
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(v)}>
                    <Edit3 size={13} /> Edit
                  </button>
                  {canPrintLabels && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setLabelEditorSingleVariant(v)}>
                      <Printer size={13} /> Label
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Add Product Modal */}
      {isQuickAddOpen && (
        <QuickAddProductModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          initialProductType={selectedTypeFilter === "ALL" ? "FOOTWEAR" : selectedTypeFilter}
        />
      )}

      {/* Edit Product Modal */}
      {editingItem && (
        <EditProductModal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          product={editingItem.product}
          variant={editingItem.variant}
        />
      )}

      {/* Single Label Editor Modal */}
      {labelEditorSingleVariant && (
        <LabelEditorModal
          isOpen={Boolean(labelEditorSingleVariant)}
          onClose={() => setLabelEditorSingleVariant(null)}
          singleVariant={labelEditorSingleVariant}
          stockMap={stockMap}
        />
      )}

      {/* Batch Label Editor Modal */}
      {isLabelEditorBatchOpen && (
        <LabelEditorModal
          isOpen={isLabelEditorBatchOpen}
          onClose={() => setIsLabelEditorBatchOpen(false)}
          batchVariants={selectedBatchVariants.length > 0 ? selectedBatchVariants : filteredVariants}
          stockMap={stockMap}
        />
      )}
    </div>
  );
}
