// src/components/inventory/InventoryView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getVariants,
  getInventoryForShop,
  getStockMovements,
  adjustStock,
  getStockCounts,
  startStockCount,
  submitStockCount,
  approveStockCount,
  getBrands,
  getCategories,
  getProducts,
  getStockCheckRows,
  getCentralStockReport,
  StockCheckRow,
  CentralStockRow,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { ProductVariant, Inventory, StockMovement, StockCount, StockCountStatus, ProductType } from "@/types";
import { CameraScannerModal } from "@/components/common/CameraScannerModal";
import {
  Boxes,
  Search,
  AlertTriangle,
  History,
  SlidersHorizontal,
  ClipboardList,
  Camera,
  Check,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  X,
} from "lucide-react";

export function InventoryView() {
  const { activeShop, shops, currentUser, showToast, refreshData, dataVersion, hasPermission } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isCashier = currentUser?.role === "CASHIER";

  // Navigation tab for Super Admin
  const [activeTab, setActiveTab] = useState<"CENTRAL_STOCK" | "MOVEMENTS" | "COUNT">("CENTRAL_STOCK");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | ProductType>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedGender, setSelectedGender] = useState<string>("ALL");
  const [selectedStockStatus, setSelectedStockStatus] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Camera Barcode Scanner
  const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [adjustShopId, setAdjustShopId] = useState(activeShop.id);
  const [adjustType, setAdjustType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE">("ADJUSTMENT_IN");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stock Count Modal State
  const [isStartCountModalOpen, setIsStartCountModalOpen] = useState(false);
  const [countScope, setCountScope] = useState<"ALL" | "BRAND" | "CATEGORY">("ALL");
  const [countScopeFilter, setCountScopeFilter] = useState("");
  const [activeCountSession, setActiveCountSession] = useState<StockCount | null>(null);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});

  // Other branch determination
  const otherShop = useMemo(
    () => shops.find((s) => s.id !== activeShop.id) || shops[0],
    [shops, activeShop.id]
  );

  // Reference data
  const brands = useMemo(() => getBrands(), [dataVersion]);
  const categories = useMemo(() => getCategories(), [dataVersion]);
  const variants = useMemo(() => getVariants(), [dataVersion]);
  const movements = useMemo(() => getStockMovements(activeShop.id), [activeShop.id, dataVersion]);
  const stockCounts = useMemo(() => getStockCounts(activeShop.id), [activeShop.id, dataVersion]);

  // Cashier Stock Check Data
  const cashierStockRows = useMemo(() => {
    return getStockCheckRows(activeShop.id, otherShop.id);
  }, [activeShop.id, otherShop.id, dataVersion]);

  // Super Admin Central Stock Data
  const centralStockReport = useMemo(() => {
    if (!isSuperAdmin) return null;
    try {
      return getCentralStockReport(currentUser);
    } catch {
      return null;
    }
  }, [isSuperAdmin, currentUser, dataVersion]);

  // Filter categories by selectedType
  const filteredCategories = useMemo(() => {
    if (selectedType === "ALL") return categories;
    return categories.filter((c) => !c.productType || c.productType === selectedType);
  }, [categories, selectedType]);

  // Filtered Cashier Rows
  const filteredCashierRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cashierStockRows.filter((r) => {
      if (selectedType !== "ALL" && r.productType !== selectedType) return false;
      if (selectedCategory !== "ALL" && r.categoryName !== selectedCategory) return false;
      if (selectedBrand !== "ALL" && r.brandName !== selectedBrand) return false;
      if (selectedGender !== "ALL" && r.gender !== selectedGender) return false;

      if (selectedStockStatus === "IN_STOCK" && r.thisBranchStock <= 0) return false;
      if (selectedStockStatus === "LOW_STOCK" && (r.thisBranchStock <= 0 || r.thisBranchStock > r.reorderLevel)) return false;
      if (selectedStockStatus === "OUT_OF_STOCK" && r.thisBranchStock > 0) return false;

      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.brandName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.barcode.includes(q) ||
        r.colorName.toLowerCase().includes(q) ||
        r.sizeLabel.toLowerCase().includes(q)
      );
    });
  }, [cashierStockRows, searchQuery, selectedType, selectedCategory, selectedBrand, selectedGender, selectedStockStatus]);

  // Filtered Central Stock Rows (Super Admin)
  const filteredCentralRows = useMemo(() => {
    if (!centralStockReport) return [];
    const q = searchQuery.toLowerCase().trim();
    return centralStockReport.rows.filter((r) => {
      if (selectedType !== "ALL" && r.productType !== selectedType) return false;
      if (selectedCategory !== "ALL" && r.categoryName !== selectedCategory) return false;
      if (selectedBrand !== "ALL" && r.brandName !== selectedBrand) return false;
      if (selectedGender !== "ALL" && r.gender !== selectedGender) return false;

      if (selectedStockStatus === "IN_STOCK" && r.totalStock <= 0) return false;
      if (selectedStockStatus === "LOW_STOCK" && (r.totalStock <= 0 || r.totalStock > r.reorderLevel)) return false;
      if (selectedStockStatus === "OUT_OF_STOCK" && r.totalStock > 0) return false;

      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.brandName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.barcode.includes(q) ||
        r.colorName.toLowerCase().includes(q) ||
        r.sizeLabel.toLowerCase().includes(q)
      );
    });
  }, [centralStockReport, searchQuery, selectedType, selectedCategory, selectedBrand, selectedGender, selectedStockStatus]);

  // Handle Adjustment Submission
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      showToast("Select a product variant to adjust.", "error");
      return;
    }
    const qty = parseInt(adjustQuantity) || 0;
    if (qty <= 0) {
      showToast("Quantity must be greater than zero.", "error");
      return;
    }
    if (!adjustReason.trim()) {
      showToast("A reason for stock adjustment is mandatory.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await adjustStock({
        shopId: adjustShopId,
        variantId: selectedVariantId,
        type: adjustType,
        quantity: qty,
        reason: adjustReason.trim(),
        userId: currentUser?.displayName || "Super Admin",
      });

      showToast("Stock adjustment logged and inventory updated.", "success");
      setIsAdjustModalOpen(false);
      setSelectedVariantId("");
      setAdjustReason("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to adjust stock", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CSV Export for Super Admin
  const handleExportCSV = () => {
    if (!centralStockReport) return;
    const headers = [
      "Product",
      "Brand",
      "Category",
      "Type",
      "Colour",
      "Size",
      "SKU",
      "Barcode",
      "RightWay Stock",
      "Mega Stock",
      "Total Stock",
      "Reorder Level",
      "Selling Price (LKR)",
      "Cost Price (LKR)",
      "Retail Valuation (LKR)",
      "Cost Valuation (LKR)",
    ];

    const rows = centralStockReport.rows.map((r) => [
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${r.brandName.replace(/"/g, '""')}"`,
      `"${r.categoryName.replace(/"/g, '""')}"`,
      `"${r.productType || "FOOTWEAR"}"`,
      `"${r.colorName.replace(/"/g, '""')}"`,
      `"${r.sizeLabel.replace(/"/g, '""')}"`,
      `"${r.sku}"`,
      `"${r.barcode}"`,
      r.rightWayStock,
      r.megaStock,
      r.totalStock,
      r.reorderLevel,
      r.sellingPrice,
      r.referenceCostPrice,
      r.retailValuation,
      r.costValuation,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `central-stock-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Central stock CSV exported successfully.", "success");
  };

  // Stock count handlers
  const handleStartCount = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const count = await startStockCount({
        shopId: activeShop.id,
        scope: countScope,
        scopeFilter: countScopeFilter || undefined,
        initiatedBy: currentUser.uid,
        initiatedByName: currentUser.displayName,
      });

      showToast(`Stock count ${count.countNumber} started!`, "success");
      setIsStartCountModalOpen(false);
      setActiveCountSession(count);
      const initialMap: Record<string, number> = {};
      count.lines.forEach((l) => {
        initialMap[l.variantId] = 0;
      });
      setCountedQuantities(initialMap);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to start stock count", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCount = async () => {
    if (!activeCountSession || !currentUser) return;
    setIsSubmitting(true);
    try {
      const lines = Object.entries(countedQuantities).map(([variantId, countedQuantity]) => ({
        variantId,
        countedQuantity,
      }));

      await submitStockCount({
        countId: activeCountSession.id,
        lines,
        submittedBy: currentUser.displayName,
      });

      showToast(`Stock count ${activeCountSession.countNumber} submitted.`, "success");
      setActiveCountSession(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to submit stock count", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveCount = async (count: StockCount) => {
    if (!currentUser) return;
    if (!confirm(`Approve stock count ${count.countNumber}? This will post automated stock adjustments.`)) {
      return;
    }
    try {
      await approveStockCount({
        countId: count.id,
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName,
      });
      showToast(`Stock count ${count.countNumber} approved and reconciled!`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to approve stock count", "error");
    }
  };

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            {isCashier ? "Stock Check" : "Central Stock & Inventory"}
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            {isCashier
              ? `Check inventory across both branches &bull; Active: ${activeShop.name}`
              : "Company-wide multi-branch inventory, valuations, transfers & counts"}
          </div>
        </div>

        {/* Super Admin Action Buttons */}
        {isSuperAdmin && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={handleExportCSV}
              style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedVariantId("");
                setAdjustQuantity("1");
                setAdjustReason("");
                setIsAdjustModalOpen(true);
              }}
              style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <SlidersHorizontal size={15} />
              <span>Adjust stock</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setIsStartCountModalOpen(true)}
              style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <ClipboardList size={16} />
              <span>New stock count</span>
            </button>
          </div>
        )}
      </div>

      {/* ── SUPER ADMIN KPI CARDS (Company Total + Valuations) ── */}
      {isSuperAdmin && centralStockReport && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Company Stock</div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {centralStockReport.totalUnits} units
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
              RightWay: {centralStockReport.rightWayUnits} | Mega: {centralStockReport.megaUnits}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "var(--primary-ink)", fontWeight: "600", textTransform: "uppercase" }}>Retail Valuation</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--primary)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(centralStockReport.totalRetailValuation)}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Cost Valuation</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(centralStockReport.totalCostValuation)}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "var(--success)", fontWeight: "600", textTransform: "uppercase" }}>Estimated Gross Margin</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--success)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {centralStockReport.totalRetailValuation > 0
                ? `${Math.round(((centralStockReport.totalRetailValuation - centralStockReport.totalCostValuation) / centralStockReport.totalRetailValuation) * 100)}%`
                : "0%"}
            </div>
          </div>
        </div>
      )}

      {/* ── SUPER ADMIN TABS ── */}
      {isSuperAdmin && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
          <div className="seg-control" style={{ width: "fit-content" }}>
            <button
              className={activeTab === "CENTRAL_STOCK" ? "active" : ""}
              onClick={() => setActiveTab("CENTRAL_STOCK")}
            >
              <Boxes size={15} /> Central Stock ({filteredCentralRows.length})
            </button>
            <button
              className={activeTab === "MOVEMENTS" ? "active" : ""}
              onClick={() => setActiveTab("MOVEMENTS")}
            >
              <History size={15} /> Movements ({movements.length})
            </button>
            <button
              className={activeTab === "COUNT" ? "active" : ""}
              onClick={() => setActiveTab("COUNT")}
            >
              <ClipboardList size={15} /> Stock Counts ({stockCounts.length})
            </button>
          </div>
        </div>
      )}

      {/* ── SEARCH & FILTERS BAR (For Cashier Stock Check & Super Admin Central Stock) ── */}
      {(isCashier || activeTab === "CENTRAL_STOCK") && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Main Search Input */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                background: "var(--surface-sunken)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "0 12px",
                height: "44px",
              }}
            >
              <Search size={18} color="var(--ink-3)" style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Scan barcode or search model, brand, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "15px",
                  color: "var(--ink)",
                  width: "100%",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px" }}
                >
                  <X size={16} color="var(--ink-3)" />
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCameraScanOpen(true)}
              style={{ height: "44px", width: "44px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Camera Scan Barcode"
            >
              <Camera size={18} />
            </button>
          </div>

          {/* Filter Pills / Dropdowns */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Product Type */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Types</option>
              <option value="FOOTWEAR">Footwear</option>
              <option value="BAG">Bags</option>
            </select>

            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Categories</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Brand */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Gender */}
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Genders</option>
              <option value="MEN">Men</option>
              <option value="WOMEN">Women</option>
              <option value="UNISEX">Unisex</option>
              <option value="BOYS">Boys</option>
              <option value="GIRLS">Girls</option>
            </select>

            {/* Stock Status */}
            <select
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value as any)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>

            {(selectedType !== "ALL" ||
              selectedCategory !== "ALL" ||
              selectedBrand !== "ALL" ||
              selectedGender !== "ALL" ||
              selectedStockStatus !== "ALL" ||
              searchQuery) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedType("ALL");
                  setSelectedCategory("ALL");
                  setSelectedBrand("ALL");
                  setSelectedGender("ALL");
                  setSelectedStockStatus("ALL");
                  setSearchQuery("");
                }}
                style={{ fontSize: "12px", color: "var(--danger)" }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CASHIER STOCK CHECK VIEW ── */}
      {isCashier && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredCashierRows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
              No items found matching the search criteria.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="desktop-only pos-table-container">
                <div className="pos-table-scroll">
                  <table className="pos-table">
                    <thead>
                      <tr>
                        <th>Item model</th>
                        <th>Brand</th>
                        <th>Category</th>
                        <th>Colour</th>
                        <th>Size</th>
                        <th>Barcode</th>
                        <th className="num">Price</th>
                        <th className="num" style={{ color: "var(--primary-ink)" }}>{activeShop.name} (Here)</th>
                        <th className="num" style={{ color: "var(--ink-2)" }}>{otherShop.name}</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCashierRows.map((r) => {
                        const isOutThis = r.thisBranchStock <= 0;
                        const isLowThis = r.thisBranchStock > 0 && r.thisBranchStock <= r.reorderLevel;
                        return (
                          <tr key={r.variantId}>
                            <td style={{ fontWeight: "700", color: "var(--ink)" }}>{r.productName}</td>
                            <td style={{ color: "var(--ink-2)" }}>{r.brandName}</td>
                            <td style={{ color: "var(--ink-3)", fontSize: "13px" }}>{r.categoryName || r.productType}</td>
                            <td style={{ color: "var(--ink-2)" }}>{r.colorName}</td>
                            <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{r.sizeLabel}</td>
                            <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "13px", color: "var(--ink-3)" }}>
                              {r.barcode}
                            </td>
                            <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(r.sellingPrice)}
                            </td>
                            <td
                              className="num"
                              style={{
                                fontWeight: "800",
                                fontVariantNumeric: "tabular-nums",
                                fontSize: "15px",
                                color: isOutThis ? "var(--danger)" : isLowThis ? "var(--warning)" : "var(--ink)",
                              }}
                            >
                              {r.thisBranchStock}
                            </td>
                            <td
                              className="num"
                              style={{
                                fontWeight: "700",
                                fontVariantNumeric: "tabular-nums",
                                fontSize: "14px",
                                color: r.otherBranchStock > 0 ? "var(--ink-2)" : "var(--ink-3)",
                              }}
                            >
                              {r.otherBranchStock}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  isOutThis
                                    ? r.otherBranchStock > 0
                                      ? "badge-warning"
                                      : "badge-danger"
                                    : isLowThis
                                    ? "badge-warning"
                                    : "badge-success"
                                }`}
                              >
                                {isOutThis
                                  ? r.otherBranchStock > 0
                                    ? `Other branch: ${r.otherBranchStock}`
                                    : "Out of stock"
                                  : isLowThis
                                  ? `Low (≤${r.reorderLevel})`
                                  : "In stock"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards View */}
              <div
                className="mobile-only"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {filteredCashierRows.map((r) => {
                  const isOutThis = r.thisBranchStock <= 0;
                  return (
                    <div
                      key={r.variantId}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-tile)",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{r.brandName} &bull; {r.categoryName}</div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)" }}>{r.productName}</div>
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--primary)" }}>
                          {formatCurrency(r.sellingPrice)}
                        </div>
                      </div>

                      <div style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                        Colour: <strong>{r.colorName}</strong> | Size: <strong>{r.sizeLabel}</strong>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                        Barcode: {r.barcode} | SKU: {r.sku}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                          marginTop: "6px",
                          paddingTop: "8px",
                          borderTop: "1px solid var(--line)",
                          fontSize: "13px",
                        }}
                      >
                        <div
                          style={{
                            padding: "6px 8px",
                            background: isOutThis ? "var(--danger-soft)" : "var(--primary-soft)",
                            borderRadius: "6px",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "var(--ink-2)" }}>This Branch</div>
                          <div style={{ fontSize: "16px", fontWeight: "800", color: isOutThis ? "var(--danger)" : "var(--primary-ink)" }}>
                            {r.thisBranchStock}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "6px 8px",
                            background: "var(--surface-sunken)",
                            borderRadius: "6px",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "var(--ink-2)" }}>{otherShop.name}</div>
                          <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)" }}>
                            {r.otherBranchStock}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SUPER ADMIN TAB 1: CENTRAL STOCK TABLE ── */}
      {isSuperAdmin && activeTab === "CENTRAL_STOCK" && (
        <div className="pos-table-container">
          {filteredCentralRows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
              No inventory rows found matching criteria.
            </div>
          ) : (
            <div className="pos-table-scroll">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Item model</th>
                    <th>Brand</th>
                    <th>Colour & Size</th>
                    <th>Barcode</th>
                    <th className="num">RightWay</th>
                    <th className="num">Mega</th>
                    <th className="num" style={{ color: "var(--primary-ink)" }}>Total Units</th>
                    <th className="num">Cost Price</th>
                    <th className="num">Selling Price</th>
                    <th className="num">Retail Val.</th>
                    <th className="num">Cost Val.</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCentralRows.map((r) => {
                    const isOut = r.totalStock <= 0;
                    const isLow = r.totalStock > 0 && r.totalStock <= r.reorderLevel;
                    return (
                      <tr key={r.variantId}>
                        <td style={{ fontWeight: "700", color: "var(--ink)" }}>{r.productName}</td>
                        <td style={{ color: "var(--ink-2)" }}>{r.brandName}</td>
                        <td style={{ color: "var(--ink-2)" }}>{r.colorName} - {r.sizeLabel}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "13px", color: "var(--ink-3)" }}>
                          {r.barcode}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                          {r.rightWayStock}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                          {r.megaStock}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: "800", fontSize: "15px", color: "var(--primary-ink)" }}>
                          {r.totalStock}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                          {formatCurrency(r.referenceCostPrice)}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                          {formatCurrency(r.sellingPrice)}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--primary)" }}>
                          {formatCurrency(r.retailValuation)}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                          {formatCurrency(r.costValuation)}
                        </td>
                        <td>
                          <span className={`badge ${isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"}`}>
                            {isOut ? "Out of stock" : isLow ? `Low (≤${r.reorderLevel})` : "In stock"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedVariantId(r.variantId);
                              setAdjustQuantity("1");
                              setAdjustReason("");
                              setIsAdjustModalOpen(true);
                            }}
                            style={{ height: "32px", fontSize: "12px", padding: "0 8px" }}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUPER ADMIN TAB 2: STOCK MOVEMENTS AUDIT LOG ── */}
      {isSuperAdmin && activeTab === "MOVEMENTS" && (
        <div className="pos-table-container">
          {movements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
              No stock movements recorded yet for this branch.
            </div>
          ) : (
            <div className="pos-table-scroll">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Date & time</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th className="num">Qty</th>
                    <th>Before &rarr; After</th>
                    <th>Reason / notes</th>
                    <th>Reference</th>
                    <th>Staff user</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const isOut = m.direction === "OUT";
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(m.createdAt)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              m.type === "SALE_OUT"
                                ? "badge-primary"
                                : m.type === "PURCHASE_IN"
                                ? "badge-success"
                                : m.type === "TRANSFER_IN"
                                ? "badge-success"
                                : m.type === "TRANSFER_OUT"
                                ? "badge-warning"
                                : m.type === "DAMAGE"
                                ? "badge-danger"
                                : "badge-neutral"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: "700", color: isOut ? "var(--danger)" : "var(--success)" }}>
                          {isOut ? "OUT (-)" : "IN (+)"}
                        </td>
                        <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {m.quantity}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)", fontSize: "13px" }}>
                          {m.quantityBefore} &rarr; {m.quantityAfter}
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.reason || "Operational action"}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "12px", color: "var(--ink-3)" }}>
                          {m.referenceId}
                        </td>
                        <td style={{ fontSize: "13px" }}>{m.userId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUPER ADMIN TAB 3: PHYSICAL STOCK COUNTS ── */}
      {isSuperAdmin && activeTab === "COUNT" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Active Counting Session Banner */}
          {activeCountSession && (
            <div
              style={{
                background: "var(--surface)",
                border: "2px solid var(--primary)",
                borderRadius: "var(--radius-tile)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: "700", background: "var(--primary-soft)", color: "var(--primary-ink)", padding: "3px 8px", borderRadius: "4px" }}>
                    BLIND COUNTING ACTIVE
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
                    Stock Count #{activeCountSession.countNumber} ({activeCountSession.scope})
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                    Scan or enter physical pairs counted on shelves. Expected quantities remain hidden until submission.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    onClick={handleSubmitCount}
                    style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Check size={16} />
                    <span>Submit count</span>
                  </button>
                </div>
              </div>

              {/* Counting Lines Table */}
              <div className="pos-table-container" style={{ maxHeight: "380px" }}>
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "380px", position: "relative" }}>
                  <table className="pos-table pos-table-form">
                    <thead>
                      <tr>
                        <th>Shoe model</th>
                        <th>Color & Size</th>
                        <th>Barcode</th>
                        <th className="num" style={{ width: "160px" }}>Counted Pairs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCountSession.lines.map((l) => {
                        const v = variants.find((variant) => variant.id === l.variantId);
                        if (!v) return null;
                        const countVal = countedQuantities[v.id] || 0;
                        return (
                          <tr key={v.id}>
                            <td style={{ fontWeight: "700" }}>{v.productNameCache}</td>
                            <td style={{ color: "var(--ink-2)" }}>{v.colorNameCache} - {v.sizeLabelCache}</td>
                            <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>{v.barcode}</td>
                            <td className="num">
                              <input
                                type="number"
                                min="0"
                                value={countVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setCountedQuantities((prev) => ({ ...prev, [v.id]: Math.max(0, val) }));
                                }}
                                className="input-field"
                                style={{ width: "80px", textAlign: "right", height: "34px", marginLeft: "auto" }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Past Stock Count Sessions */}
          <div className="pos-table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Stock Count Register ({stockCounts.length})
              </h3>
            </div>
            {stockCounts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
                No stock counts recorded yet for this branch. Click &quot;New stock count&quot; to initiate a physical audit.
              </div>
            ) : (
              <div className="pos-table-scroll">
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Count #</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Initiated at / by</th>
                      <th>Submitted at / by</th>
                      <th className="num">Variance items</th>
                      <th>Approved by</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockCounts.map((sc) => (
                      <tr key={sc.id}>
                        <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{sc.countNumber}</td>
                        <td>{sc.scope}</td>
                        <td>
                          <span
                            className={`badge ${
                              sc.status === "APPROVED"
                                ? "badge-success"
                                : sc.status === "SUBMITTED"
                                ? "badge-warning"
                                : "badge-neutral"
                            }`}
                          >
                            {sc.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                          {formatDate(sc.snapshotAt)} &bull; {sc.initiatedByName}
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                          {sc.submittedAt ? formatDate(sc.submittedAt) : "-"}
                        </td>
                        <td className="num" style={{ fontWeight: "700", color: sc.totalVarianceItems > 0 ? "var(--danger)" : "var(--success)" }}>
                          {sc.totalVarianceItems}
                        </td>
                        <td style={{ fontSize: "13px" }}>{sc.approvedByName || "-"}</td>
                        <td>
                          {sc.status === "SUBMITTED" && isSuperAdmin && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApproveCount(sc)}
                              style={{ height: "32px", fontSize: "12px", padding: "0 10px" }}
                            >
                              Approve reconciliation
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: ADJUST STOCK (SUPER ADMIN ONLY) ── */}
      {isAdjustModalOpen && isSuperAdmin && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Adjust Physical Stock
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="var(--ink-3)" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="pos-label">Branch</label>
                <select
                  value={adjustShopId}
                  onChange={(e) => setAdjustShopId(e.target.value)}
                  className="pos-input"
                  style={{ height: "42px" }}
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pos-label">Product variant</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="pos-input"
                  style={{ height: "42px" }}
                  required
                >
                  <option value="">Select a variant...</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productNameCache} - {v.colorNameCache} (Size: {v.sizeLabelCache}) [{v.sku}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pos-label">Adjustment type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="pos-input"
                  style={{ height: "42px" }}
                >
                  <option value="ADJUSTMENT_IN">Stock In (Found inventory / Discrepancy +)</option>
                  <option value="ADJUSTMENT_OUT">Stock Out (Shrinkage / Missing inventory -)</option>
                  <option value="DAMAGE">Damaged Goods (Defective write-off -)</option>
                </select>
              </div>

              <div>
                <label className="pos-label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="pos-input"
                  style={{ height: "42px" }}
                  required
                />
              </div>

              <div>
                <label className="pos-label">Reason / Justification</label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Detailed explanation for stock audit trail..."
                  className="pos-input"
                  style={{ height: "80px", resize: "none" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAdjustModalOpen(false)}
                  style={{ height: "42px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ height: "42px" }}
                >
                  Confirm adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: START STOCK COUNT (SUPER ADMIN) ── */}
      {isStartCountModalOpen && isSuperAdmin && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Initiate Physical Stock Count
              </h3>
              <button
                type="button"
                onClick={() => setIsStartCountModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="var(--ink-3)" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="pos-label">Scope</label>
                <select
                  value={countScope}
                  onChange={(e) => setCountScope(e.target.value as any)}
                  className="pos-input"
                  style={{ height: "42px" }}
                >
                  <option value="ALL">Entire Branch Catalogue (All Items)</option>
                  <option value="BRAND">Filter by Specific Brand</option>
                  <option value="CATEGORY">Filter by Specific Category</option>
                </select>
              </div>

              {countScope === "BRAND" && (
                <div>
                  <label className="pos-label">Select Brand</label>
                  <select
                    value={countScopeFilter}
                    onChange={(e) => setCountScopeFilter(e.target.value)}
                    className="pos-input"
                    style={{ height: "42px" }}
                  >
                    <option value="">Select a brand...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {countScope === "CATEGORY" && (
                <div>
                  <label className="pos-label">Select Category</label>
                  <select
                    value={countScopeFilter}
                    onChange={(e) => setCountScopeFilter(e.target.value)}
                    className="pos-input"
                    style={{ height: "42px" }}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsStartCountModalOpen(false)}
                  style={{ height: "42px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  onClick={handleStartCount}
                  style={{ height: "42px" }}
                >
                  Start count session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CAMERA SCANNER MODAL ── */}
      {isCameraScanOpen && (
        <CameraScannerModal
          isOpen={isCameraScanOpen}
          onClose={() => setIsCameraScanOpen(false)}
          onScan={(code) => {
            setIsCameraScanOpen(false);
            setSearchQuery(code);
            showToast(`Scanned barcode: ${code}`, "info");
          }}
        />
      )}
    </div>
  );
}
