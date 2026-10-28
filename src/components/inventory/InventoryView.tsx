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
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { ProductVariant, Inventory, StockMovement, StockCount, StockCountStatus } from "@/types";
import { CameraScannerModal } from "@/components/common/CameraScannerModal";
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  History,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  X,
  CheckCircle2,
  ClipboardList,
  Camera,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

export function InventoryView() {
  const { activeShop, currentUser, showToast, refreshData, dataVersion, hasPermission } = useApp();

  const [activeTab, setActiveTab] = useState<"STOCK" | "MOVEMENTS" | "COUNT">("STOCK");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Adjustment Form
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [adjustType, setAdjustType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE">("ADJUSTMENT_IN");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stock Count State
  const [isStartCountModalOpen, setIsStartCountModalOpen] = useState(false);
  const [countScope, setCountScope] = useState<"ALL" | "BRAND" | "CATEGORY">("ALL");
  const [countScopeFilter, setCountScopeFilter] = useState("");
  const [activeCountSession, setActiveCountSession] = useState<StockCount | null>(null);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);

  const canSeeCost = currentUser?.role === "SUPER_ADMIN";
  const canAdjustStock = hasPermission("inventory.adjust");
  const canApproveCount = currentUser?.role === "SUPER_ADMIN";

  const variants = useMemo(() => getVariants(), [dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);
  const movements = useMemo(() => getStockMovements(activeShop.id), [activeShop.id, dataVersion]);
  const stockCounts = useMemo(() => getStockCounts(activeShop.id), [activeShop.id, dataVersion]);
  const brands = useMemo(() => getBrands(), [dataVersion]);
  const categories = useMemo(() => getCategories(), [dataVersion]);

  // Map variantId -> Inventory
  const invMap = useMemo(() => {
    const map: Record<string, Inventory> = {};
    inventoryList.forEach((inv) => {
      map[inv.variantId] = inv;
    });
    return map;
  }, [inventoryList]);

  // Enriched stock rows
  const enrichedStock = useMemo(() => {
    return variants.map((v) => {
      const inv = invMap[v.id];
      const qoh = inv ? inv.quantityOnHand : 0;
      const reorder = inv ? inv.reorderLevel : 3;
      return {
        variant: v,
        quantityOnHand: qoh,
        reorderLevel: reorder,
        isLow: qoh > 0 && qoh <= reorder,
        isOut: qoh === 0,
      };
    });
  }, [variants, invMap]);

  // Filtered stock
  const filteredStock = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return enrichedStock;
    return enrichedStock.filter(
      ({ variant: v }) =>
        v.productNameCache.toLowerCase().includes(q) ||
        v.brandNameCache.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.barcode.includes(q) ||
        v.colorNameCache.toLowerCase().includes(q) ||
        v.sizeLabelCache.toLowerCase().includes(q)
    );
  }, [enrichedStock, searchQuery]);

  // Summary Metrics
  const totalPairsOnHand = useMemo(
    () => enrichedStock.reduce((sum, item) => sum + item.quantityOnHand, 0),
    [enrichedStock]
  );
  const outOfStockCount = useMemo(
    () => enrichedStock.filter((item) => item.isOut).length,
    [enrichedStock]
  );
  const lowStockCount = useMemo(
    () => enrichedStock.filter((item) => item.isLow).length,
    [enrichedStock]
  );

  // Handle Adjustment Submission
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      showToast("Select a shoe variant to adjust.", "error");
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
        shopId: activeShop.id,
        variantId: selectedVariantId,
        type: adjustType,
        quantity: qty,
        reason: adjustReason.trim(),
        userId: currentUser?.displayName || "Authorized Staff",
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

  // Handle Start Stock Count
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
      // Initialize counts map
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

  // Submit Active Count
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

      showToast(`Stock count ${activeCountSession.countNumber} submitted for manager/admin approval.`, "success");
      setActiveCountSession(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to submit stock count", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Super Admin Approval of Count
  const handleApproveCount = async (count: StockCount) => {
    if (!currentUser) return;
    if (!confirm(`Approve stock count ${count.countNumber}? This will post automated stock adjustments for all variance lines.`)) {
      return;
    }

    try {
      await approveStockCount({
        countId: count.id,
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName,
      });
      showToast(`Stock count ${count.countNumber} approved and inventory reconciled!`, "success");
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
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            Branch Inventory & Stock
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Real-time stock on hand, physical stock count & audit trail &bull; {activeShop.name} ({activeShop.code})
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {canAdjustStock && (
            <button
              className="btn btn-secondary"
              onClick={() => setIsAdjustModalOpen(true)}
              style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <SlidersHorizontal size={15} />
              <span>Adjust stock</span>
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={() => setIsStartCountModalOpen(true)}
            style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ClipboardList size={16} />
            <span>New stock count</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Total Pairs on Hand</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {totalPairsOnHand} pairs
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--warning)", fontWeight: "600", textTransform: "uppercase" }}>Low Stock Warnings</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--warning)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {lowStockCount} lines
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--danger)", fontWeight: "600", textTransform: "uppercase" }}>Out of Stock</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {outOfStockCount} lines
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
        <div className="seg-control" style={{ width: "fit-content" }}>
          <button
            className={activeTab === "STOCK" ? "active" : ""}
            onClick={() => setActiveTab("STOCK")}
          >
            <Boxes size={15} /> Stock on hand ({filteredStock.length})
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

        {activeTab === "STOCK" && (
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px", height: "40px", width: "280px" }}>
            <Search size={16} color="var(--ink-3)" style={{ marginRight: "6px" }} />
            <input
              type="text"
              placeholder="Search shoe, size or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: "var(--ink)", width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* TAB 1: STOCK ON HAND */}
      {activeTab === "STOCK" && (
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
                  <th className="num">On hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map(({ variant: v, quantityOnHand, reorderLevel, isLow, isOut }) => (
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
                    <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(v.sellingPrice)}
                    </td>
                    <td className="num" style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums", fontSize: "15px" }}>
                      {quantityOnHand}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"
                        }`}
                      >
                        {isOut ? "Out of stock" : isLow ? `Low (≤${reorderLevel})` : "In stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENTS AUDIT LOG */}
      {activeTab === "MOVEMENTS" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
          {movements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
              No stock movements recorded yet for this branch. Stock movements are created on sales, purchases, transfers, and adjustments.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
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

      {/* TAB 3: PHYSICAL STOCK COUNTS (Section 6.3) */}
      {activeTab === "COUNT" && (
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
                    className="btn btn-secondary"
                    onClick={() => setIsCameraScanOpen(true)}
                    style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Camera size={16} />
                    <span>Camera Scan</span>
                  </button>

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
              <div style={{ maxHeight: "360px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <table className="pos-table">
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
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  setCountedQuantities((prev) => ({
                                    ...prev,
                                    [v.id]: Math.max(0, (prev[v.id] || 0) - 1),
                                  }))
                                }
                                style={{ width: "32px", height: "32px", padding: 0 }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={countVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setCountedQuantities((prev) => ({
                                    ...prev,
                                    [v.id]: Math.max(0, val),
                                  }));
                                }}
                                style={{
                                  width: "54px",
                                  height: "32px",
                                  textAlign: "center",
                                  fontWeight: "700",
                                  border: "1px solid var(--line-strong)",
                                  borderRadius: "6px",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              />
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  setCountedQuantities((prev) => ({
                                    ...prev,
                                    [v.id]: (prev[v.id] || 0) + 1,
                                  }))
                                }
                                style={{ width: "32px", height: "32px", padding: 0 }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Past Stock Counts List */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: "700", fontSize: "16px", color: "var(--ink)" }}>
              Stock Count History
            </div>

            {stockCounts.length === 0 ? (
              <div style={{ padding: "36px", textAlign: "center", color: "var(--ink-3)", fontSize: "14px" }}>
                No physical stock counts recorded for this branch yet. Click "New stock count" to initiate a blind stocktake.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Count #</th>
                      <th>Date</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Initiator</th>
                      <th className="num">Discrepancy items</th>
                      <th className="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockCounts.map((sc) => (
                      <tr key={sc.id}>
                        <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{sc.countNumber}</td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(sc.snapshotAt)}</td>
                        <td>{sc.scope}</td>
                        <td>
                          <span
                            className={`badge ${
                              sc.status === "APPROVED"
                                ? "badge-success"
                                : sc.status === "SUBMITTED"
                                ? "badge-warning"
                                : sc.status === "COUNTING"
                                ? "badge-primary"
                                : "badge-neutral"
                            }`}
                          >
                            {sc.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "13px" }}>{sc.initiatedByName}</td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: "700" }}>
                          {sc.totalVarianceItems} lines
                        </td>
                        <td className="num">
                          {sc.status === "SUBMITTED" && canApproveCount && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApproveCount(sc)}
                              style={{ height: "32px", fontSize: "12px" }}
                            >
                              Approve count
                            </button>
                          )}
                          {sc.status === "APPROVED" && (
                            <span style={{ fontSize: "12px", color: "var(--success)", fontWeight: "600" }}>
                              Reconciled
                            </span>
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

      {/* Start Count Modal */}
      {isStartCountModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "440px", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "var(--shadow-float)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Start New Stock Count</h3>
              <button onClick={() => setIsStartCountModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)" }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--ink-2)", margin: 0 }}>
              Initiates a blind physical stock count for {activeShop.name}. Expected quantities will be hidden from staff during counting.
            </p>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Count Scope</label>
              <select
                className="input-field"
                value={countScope}
                onChange={(e) => setCountScope(e.target.value as any)}
                style={{ width: "100%", height: "42px" }}
              >
                <option value="ALL">All Footwear in Shop</option>
                <option value="BRAND">By Brand</option>
                <option value="CATEGORY">By Category</option>
              </select>
            </div>

            {countScope === "BRAND" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select Brand</label>
                <select
                  className="input-field"
                  value={countScopeFilter}
                  onChange={(e) => setCountScopeFilter(e.target.value)}
                  style={{ width: "100%", height: "42px" }}
                >
                  <option value="">Select a brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {countScope === "CATEGORY" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select Category</label>
                <select
                  className="input-field"
                  value={countScopeFilter}
                  onChange={(e) => setCountScopeFilter(e.target.value)}
                  style={{ width: "100%", height: "42px" }}
                >
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setIsStartCountModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStartCount} disabled={isSubmitting}>
                {isSubmitting ? "Starting..." : "Begin Count"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "480px", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "var(--shadow-float)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Manual Stock Adjustment</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Shoe Variant</label>
                <select
                  required
                  className="input-field"
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  style={{ width: "100%", height: "42px" }}
                >
                  <option value="">Select shoe variant...</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productNameCache} ({v.colorNameCache}, {v.sizeLabelCache}) &bull; Stock: {invMap[v.id]?.quantityOnHand || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Action</label>
                  <select
                    className="input-field"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    style={{ width: "100%", height: "42px" }}
                  >
                    <option value="ADJUSTMENT_IN">Add (+) Stock</option>
                    <option value="ADJUSTMENT_OUT">Deduct (-) Stock</option>
                    <option value="DAMAGE">Write off as Damaged</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    style={{ width: "100%", height: "42px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Mandatory Reason</label>
                <textarea
                  required
                  rows={3}
                  className="input-field"
                  placeholder="Reason for adjusting stock (e.g. damaged during unboxing, supplier sample received)..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: "100%", padding: "10px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner for Stock Count */}
      <CameraScannerModal
        isOpen={isCameraScanOpen}
        onClose={() => setIsCameraScanOpen(false)}
        onScan={(code) => {
          const found = variants.find((v) => v.barcode === code || v.sku.toLowerCase() === code.toLowerCase());
          if (found) {
            setCountedQuantities((prev) => ({
              ...prev,
              [found.id]: (prev[found.id] || 0) + 1,
            }));
            showToast(`Scanned ${found.productNameCache} (${found.sizeLabelCache}) & incremented count!`, "success");
          } else {
            showToast(`No shoe matched barcode: ${code}`, "error");
          }
        }}
      />
    </div>
  );
}
