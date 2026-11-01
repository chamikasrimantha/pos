// src/components/transfers/TransfersView.tsx
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  getTransfers,
  dispatchTransfer,
  receiveTransfer,
  quickTransferStock,
  getVariants,
  getInventoryForShop,
} from "@/lib/firestore-service";
import { formatDate, renderTransferDispatchNoteHTML, renderTransferNoteHTML } from "@/lib/receipt-generator";
import { StockTransfer, ProductVariant } from "@/types";
import { CameraScannerModal } from "@/components/common/CameraScannerModal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  ArrowLeftRight,
  Send,
  CheckCircle2,
  Boxes,
  Printer,
  Plus,
  Minus,
  Trash2,
  X,
  AlertCircle,
  Truck,
  Camera,
  Search,
  History,
  Check,
  ArrowRight,
} from "lucide-react";

interface QuickTransferItemRow {
  variantId: string;
  variant: ProductVariant;
  quantity: number;
}

export function TransfersView() {
  const {
    shops,
    activeShop,
    currentUser,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // Active Tab: Quick Transfer is the default as per Section 6.3
  const [activeTab, setActiveTab] = useState<"QUICK" | "FORMAL" | "HISTORY">("QUICK");

  // ── QUICK TRANSFER STATE ──
  const [sourceShopId, setSourceShopId] = useState<string>(activeShop.id);
  const [destShopId, setDestShopId] = useState<string>(() => {
    const other = shops.find((s) => s.id !== activeShop.id);
    return other ? other.id : "mega";
  });
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [quickTransferItems, setQuickTransferItems] = useState<QuickTransferItemRow[]>([]);
  const [quickNotes, setQuickNotes] = useState("");
  const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ── FORMAL DISPATCH MODAL STATE ──
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [formalDestShopId, setFormalDestShopId] = useState<string>(
    activeShop.id === "rightway" ? "mega" : "rightway"
  );
  const [formalTransferLines, setFormalTransferLines] = useState<
    { variantId: string; quantity: number }[]
  >([]);

  // ── FORMAL RECEIVE MODAL STATE ──
  const [selectedTransferToReceive, setSelectedTransferToReceive] = useState<StockTransfer | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState("");

  // ── HISTORY FILTER STATE ──
  const [historyShopFilter, setHistoryShopFilter] = useState<string>("ALL");
  const [historyModeFilter, setHistoryModeFilter] = useState<"ALL" | "QUICK" | "FORMAL">("ALL");

  // Keep sourceShopId in sync with activeShop for cashiers
  useEffect(() => {
    if (!isSuperAdmin) {
      setSourceShopId(activeShop.id);
      const other = shops.find((s) => s.id !== activeShop.id);
      if (other) setDestShopId(other.id);
    }
  }, [activeShop.id, isSuperAdmin, shops]);

  // Focus scan input whenever quick tab is active
  useEffect(() => {
    if (activeTab === "QUICK" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeTab]);

  // Reference data
  const allVariants = useMemo(() => getVariants(), [dataVersion]);
  const sourceShopInventory = useMemo(
    () => getInventoryForShop(sourceShopId),
    [sourceShopId, dataVersion]
  );
  const destShopInventory = useMemo(
    () => getInventoryForShop(destShopId),
    [destShopId, dataVersion]
  );
  const allTransfers = useMemo(() => getTransfers(), [dataVersion]);

  // Inventory map for source shop: variantId -> quantityOnHand
  const sourceStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    sourceShopInventory.forEach((i) => {
      map[i.variantId] = i.quantityOnHand;
    });
    return map;
  }, [sourceShopInventory]);

  // Inventory map for destination shop
  const destStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    destShopInventory.forEach((i) => {
      map[i.variantId] = i.quantityOnHand;
    });
    return map;
  }, [destShopInventory]);

  // Shop objects
  const sourceShop = useMemo(
    () => shops.find((s) => s.id === sourceShopId) || activeShop,
    [shops, sourceShopId, activeShop]
  );
  const destShop = useMemo(
    () => shops.find((s) => s.id === destShopId) || shops.find((s) => s.id !== sourceShopId) || activeShop,
    [shops, destShopId, sourceShopId, activeShop]
  );

  // ── QUICK TRANSFER ITEM ADDITION ──
  const handleAddQuickVariant = (variant: ProductVariant) => {
    const sourceStock = sourceStockMap[variant.id] || 0;
    if (sourceStock <= 0) {
      showToast(`No stock available at ${sourceShop.name} for ${variant.productNameCache}.`, "error");
      return;
    }

    setQuickTransferItems((prev) => {
      const existing = prev.find((item) => item.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= sourceStock) {
          showToast(`Cannot exceed stock at source branch (${sourceStock} available)`, "error");
          return prev;
        }
        return prev.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          variant,
          quantity: 1,
        },
      ];
    });
    setBarcodeQuery("");
    if (scanInputRef.current) scanInputRef.current.focus();
  };

  const handleScanBarcode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    const variant = allVariants.find(
      (v) =>
        v.barcode === clean ||
        v.sku.toLowerCase() === clean.toLowerCase()
    );
    if (!variant) {
      showToast("No product found for this barcode", "error");
      return;
    }
    handleAddQuickVariant(variant);
  };

  // Hardware barcode scanner hook for quick transfers
  useBarcodeScanner((scannedCode) => {
    if (activeTab === "QUICK" && !isCameraScanOpen && !isConfirmModalOpen) {
      handleScanBarcode(scannedCode);
    }
  });

  const handleUpdateQuickQuantity = (variantId: string, newQty: number) => {
    const sourceStock = sourceStockMap[variantId] || 0;
    if (newQty > sourceStock) {
      showToast(`Quantity cannot exceed available stock (${sourceStock})`, "error");
      return;
    }
    if (newQty < 1) return;
    setQuickTransferItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const handleRemoveQuickItem = (variantId: string) => {
    setQuickTransferItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const totalQuickUnits = useMemo(() => {
    return quickTransferItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [quickTransferItems]);

  // Execute Quick Transfer
  const handleExecuteQuickTransfer = async () => {
    if (quickTransferItems.length === 0 || isSubmitting) return;

    // Double check availability
    for (const item of quickTransferItems) {
      const onHand = sourceStockMap[item.variantId] || 0;
      if (item.quantity > onHand) {
        showToast(`Cannot transfer ${item.variant.productNameCache}: requested ${item.quantity}, available ${onHand}`, "error");
        return;
      }
    }

    const idempotencyKey = `quick_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setIsSubmitting(true);
    try {
      const transfer = await quickTransferStock({
        fromShopId: sourceShopId,
        toShopId: destShopId,
        items: quickTransferItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        userId: currentUser?.uid || "cashier",
        userName: currentUser?.displayName || "Cashier",
        notes: quickNotes.trim() || undefined,
        idempotencyKey,
      });

      showToast(`Transfer #${transfer.transferNumber} completed!`, "success");
      setIsConfirmModalOpen(false);
      setQuickTransferItems([]);
      setQuickNotes("");
      setBarcodeQuery("");
      refreshData();

      // Print transfer note
      const noteHTML = renderTransferNoteHTML(transfer, sourceShop, destShop);
      openPrintModal(`Transfer Note — ${transfer.transferNumber}`, noteHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to execute transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── FORMAL DISPATCH FLOW ──
  const handleAddFormalLine = () => {
    const available = allVariants.find((v) => !formalTransferLines.some((l) => l.variantId === v.id));
    if (!available) {
      showToast("All variants already added to dispatch list.", "info");
      return;
    }
    setFormalTransferLines((prev) => [...prev, { variantId: available.id, quantity: 1 }]);
  };

  const handleUpdateFormalLine = (index: number, variantId: string, quantity: number) => {
    setFormalTransferLines((prev) =>
      prev.map((line, i) => (i === index ? { variantId, quantity: Math.max(1, quantity) } : line))
    );
  };

  const handleRemoveFormalLine = (index: number) => {
    setFormalTransferLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormalDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formalTransferLines.length === 0) {
      showToast("Please add at least one product variant to dispatch.", "error");
      return;
    }

    const itemsToDispatch: { variant: ProductVariant; quantity: number }[] = [];
    for (const line of formalTransferLines) {
      const v = allVariants.find((item) => item.id === line.variantId);
      if (!v) continue;
      const onHand = sourceStockMap[v.id] || 0;
      if (onHand < line.quantity) {
        showToast(`Insufficient stock for ${v.productNameCache}. (Available: ${onHand}, Requested: ${line.quantity})`, "error");
        return;
      }
      itemsToDispatch.push({ variant: v, quantity: line.quantity });
    }

    setIsSubmitting(true);
    try {
      const transfer = await dispatchTransfer({
        sourceShopId: activeShop.id,
        destinationShopId: formalDestShopId,
        items: itemsToDispatch,
        dispatchedBy: currentUser?.displayName || "Stock Officer",
      });

      showToast(`Formal transfer #${transfer.transferNumber} dispatched!`, "success");
      setIsDispatchModalOpen(false);
      setFormalTransferLines([]);
      refreshData();

      const targetShop = shops.find((s) => s.id === formalDestShopId) || activeShop;
      const noteHTML = renderTransferDispatchNoteHTML(transfer, activeShop, targetShop);
      openPrintModal(`Transfer Dispatch Note — ${transfer.transferNumber}`, noteHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormalReceive = async () => {
    if (!selectedTransferToReceive) return;
    setIsSubmitting(true);
    try {
      const updated = await receiveTransfer({
        transferId: selectedTransferToReceive.id,
        receivedBy: currentUser?.displayName || "Stock Officer",
        discrepancyNotes: discrepancyNote.trim() || undefined,
      });

      showToast(`Transfer #${updated.transferNumber} received into ${activeShop.name}!`, "success");
      setSelectedTransferToReceive(null);
      setDiscrepancyNote("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to receive transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── HISTORY FILTERING ──
  const filteredHistory = useMemo(() => {
    return allTransfers.filter((t) => {
      // Cashiers only see transfers involving their own branch
      if (!isSuperAdmin) {
        if (t.sourceShopId !== activeShop.id && t.destinationShopId !== activeShop.id) {
          return false;
        }
      } else if (historyShopFilter !== "ALL") {
        if (t.sourceShopId !== historyShopFilter && t.destinationShopId !== historyShopFilter) {
          return false;
        }
      }

      if (historyModeFilter !== "ALL") {
        const isQuick = t.mode === "QUICK";
        if (historyModeFilter === "QUICK" && !isQuick) return false;
        if (historyModeFilter === "FORMAL" && isQuick) return false;
      }

      return true;
    });
  }, [allTransfers, isSuperAdmin, activeShop.id, historyShopFilter, historyModeFilter]);

  // Formal pending transfers (for formal tab)
  const formalPendingTransfers = useMemo(() => {
    return allTransfers.filter((t) => {
      if (t.mode === "QUICK") return false;
      if (!isSuperAdmin) {
        return t.sourceShopId === activeShop.id || t.destinationShopId === activeShop.id;
      }
      return true;
    });
  }, [allTransfers, isSuperAdmin, activeShop.id]);

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
      {/* ── TOP HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            Branch Transfers
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Scan-to-transfer stock between RightWay Shoes and Mega Shoes &bull; Invariant company inventory
          </div>
        </div>

        {/* Action Button for Formal Tab */}
        {activeTab === "FORMAL" && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormalTransferLines([]);
              setIsDispatchModalOpen(true);
            }}
            style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Send size={15} />
            <span>Dispatch formal transfer</span>
          </button>
        )}
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
        <div className="seg-control" style={{ width: "fit-content" }}>
          <button
            className={activeTab === "QUICK" ? "active" : ""}
            onClick={() => setActiveTab("QUICK")}
          >
            <Boxes size={15} /> Quick Transfer
          </button>
          <button
            className={activeTab === "FORMAL" ? "active" : ""}
            onClick={() => setActiveTab("FORMAL")}
          >
            <Truck size={15} /> Formal Transfers ({formalPendingTransfers.filter((t) => t.status === "IN_TRANSIT").length})
          </button>
          <button
            className={activeTab === "HISTORY" ? "active" : ""}
            onClick={() => setActiveTab("HISTORY")}
          >
            <History size={15} /> Transfer History ({filteredHistory.length})
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB 1: QUICK TRANSFER (SCAN TO TRANSFER)
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "QUICK" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Direction Header Panel */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {/* Origin Branch */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase" }}>
                  Origin Branch (From)
                </span>
                {isSuperAdmin ? (
                  <select
                    value={sourceShopId}
                    onChange={(e) => {
                      const newSrc = e.target.value;
                      setSourceShopId(newSrc);
                      const other = shops.find((s) => s.id !== newSrc);
                      if (other) setDestShopId(other.id);
                      setQuickTransferItems([]);
                    }}
                    className="pos-input"
                    style={{ height: "42px", fontWeight: "700", fontSize: "14px" }}
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{
                      height: "42px",
                      padding: "0 14px",
                      display: "flex",
                      alignItems: "center",
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--line)",
                      borderRadius: "8px",
                      fontWeight: "700",
                      fontSize: "14px",
                      color: "var(--ink)",
                    }}
                  >
                    {sourceShop.name} ({sourceShop.code})
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{ padding: "0 4px", marginTop: "18px", color: "var(--primary)" }}>
                <ArrowRight size={22} />
              </div>

              {/* Destination Branch */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase" }}>
                  Destination Branch (To)
                </span>
                {isSuperAdmin ? (
                  <select
                    value={destShopId}
                    onChange={(e) => {
                      setDestShopId(e.target.value);
                    }}
                    className="pos-input"
                    style={{ height: "42px", fontWeight: "700", fontSize: "14px" }}
                  >
                    {shops
                      .filter((s) => s.id !== sourceShopId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                  </select>
                ) : (
                  <div
                    style={{
                      height: "42px",
                      padding: "0 14px",
                      display: "flex",
                      alignItems: "center",
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--line)",
                      borderRadius: "8px",
                      fontWeight: "700",
                      fontSize: "14px",
                      color: "var(--ink)",
                    }}
                  >
                    {destShop.name} ({destShop.code})
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontSize: "13px", color: "var(--ink-2)", maxWidth: "340px", lineHeight: "1.4" }}>
              Quick transfers atomically deduct from {sourceShop.name} and add to {destShop.name}. Total company stock remains unchanged.
            </div>
          </div>

          {/* Barcode Scanner & Search Bar */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink-2)" }}>
              Scan Barcode or Search Item
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScanBarcode(barcodeQuery);
              }}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
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
                  ref={scanInputRef}
                  type="text"
                  placeholder="Scan barcode or type SKU / model name and press Enter..."
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: "15px",
                    color: "var(--ink)",
                    width: "100%",
                  }}
                />
                {barcodeQuery && (
                  <button
                    type="button"
                    onClick={() => setBarcodeQuery("")}
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

              <button type="submit" className="btn btn-primary" style={{ height: "44px", padding: "0 18px" }}>
                Add item
              </button>
            </form>
          </div>

          {/* Transfer Line Items List */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Items to Transfer ({quickTransferItems.length} lines &bull; {totalQuickUnits} pairs)
              </h3>
              {quickTransferItems.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQuickTransferItems([])}
                  style={{ color: "var(--danger)", fontSize: "12px" }}
                >
                  Clear all
                </button>
              )}
            </div>

            {quickTransferItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
                No items added yet. Scan a product barcode or enter a SKU above to build the transfer list.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Product model</th>
                      <th>Colour</th>
                      <th>Size</th>
                      <th>SKU / Barcode</th>
                      <th className="num">{sourceShop.name} Stock</th>
                      <th className="num" style={{ width: "160px" }}>Transfer Qty</th>
                      <th className="num">{destShop.name} New Stock</th>
                      <th style={{ width: "60px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickTransferItems.map(({ variantId, variant: v, quantity }) => {
                      const onHandSource = sourceStockMap[variantId] || 0;
                      const onHandDest = destStockMap[variantId] || 0;
                      const isMax = quantity >= onHandSource;

                      return (
                        <tr key={variantId}>
                          <td style={{ fontWeight: "700", color: "var(--ink)" }}>{v.productNameCache}</td>
                          <td style={{ color: "var(--ink-2)" }}>{v.colorNameCache}</td>
                          <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{v.sizeLabelCache}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums", fontSize: "12px", color: "var(--ink-3)" }}>
                            {v.barcode} &bull; {v.sku}
                          </td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {onHandSource}
                          </td>
                          <td className="num">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={quantity <= 1}
                                onClick={() => handleUpdateQuickQuantity(variantId, quantity - 1)}
                                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={onHandSource}
                                value={quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  handleUpdateQuickQuantity(variantId, val);
                                }}
                                className="pos-input"
                                style={{ width: "56px", textAlign: "center", height: "32px", fontWeight: "700" }}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={isMax}
                                onClick={() => handleUpdateQuickQuantity(variantId, quantity + 1)}
                                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="num" style={{ fontWeight: "700", color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                            {onHandDest + quantity}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRemoveQuickItem(variantId)}
                              style={{ color: "var(--danger)", padding: "4px" }}
                              title="Remove item"
                            >
                              <Trash2 size={16} />
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

          {/* Notes and Action Bar */}
          {quickTransferItems.length > 0 && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-tile)",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div>
                <label className="pos-label">Optional transfer notes</label>
                <input
                  type="text"
                  placeholder="e.g. Urgently requested for customer order at Mega Shoes..."
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  className="pos-input"
                  style={{ height: "42px" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--line)",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "14px", color: "var(--ink-2)" }}>
                  Ready to transfer <strong>{quickTransferItems.length}</strong> items (<strong>{totalQuickUnits}</strong> units) from{" "}
                  <strong>{sourceShop.name}</strong> to <strong>{destShop.name}</strong>.
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isSubmitting || quickTransferItems.length === 0}
                  style={{ height: "44px", padding: "0 24px", fontSize: "15px", fontWeight: "700" }}
                >
                  <ArrowLeftRight size={16} /> Transfer now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2: FORMAL TRANSFERS (DISPATCH & RECEIVE)
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "FORMAL" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Formal Stock Transfers &bull; Dispatched & In-Transit ({formalPendingTransfers.length})
            </h3>
          </div>

          {formalPendingTransfers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
              No formal transfers found. Use &quot;Dispatch formal transfer&quot; above to initiate a dispatch note.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Transfer #</th>
                    <th>Origin branch</th>
                    <th>Destination branch</th>
                    <th className="num">Total units</th>
                    <th>Dispatched at</th>
                    <th>Dispatched by</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formalPendingTransfers.map((t) => {
                    const isOrigin = t.sourceShopId === activeShop.id;
                    const isDest = t.destinationShopId === activeShop.id;
                    const canReceive = t.status === "IN_TRANSIT" && (isDest || isSuperAdmin);

                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{t.transferNumber}</td>
                        <td style={{ fontWeight: isOrigin ? "700" : "normal" }}>
                          {shops.find((s) => s.id === t.sourceShopId)?.name || t.sourceShopId}
                        </td>
                        <td style={{ fontWeight: isDest ? "700" : "normal" }}>
                          {shops.find((s) => s.id === t.destinationShopId)?.name || t.destinationShopId}
                        </td>
                        <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {t.totalQuantity}
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>{formatDate(t.dispatchedAt)}</td>
                        <td style={{ fontSize: "13px" }}>{t.dispatchedBy}</td>
                        <td>
                          <span
                            className={`badge ${
                              t.status === "RECEIVED"
                                ? "badge-success"
                                : t.status === "IN_TRANSIT"
                                ? "badge-warning"
                                : "badge-neutral"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {canReceive && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedTransferToReceive(t);
                                  setDiscrepancyNote("");
                                }}
                                style={{ height: "32px", fontSize: "12px", padding: "0 10px" }}
                              >
                                <Check size={14} /> Receive
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const sShop = shops.find((s) => s.id === t.sourceShopId) || activeShop;
                                const dShop = shops.find((s) => s.id === t.destinationShopId) || activeShop;
                                const noteHTML = renderTransferDispatchNoteHTML(t, sShop, dShop);
                                openPrintModal(`Transfer Note — ${t.transferNumber}`, noteHTML);
                              }}
                              style={{ height: "32px", fontSize: "12px", padding: "0 8px" }}
                              title="Print Note"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
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

      {/* ══════════════════════════════════════════════════════════
          TAB 3: TRANSFER HISTORY
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "HISTORY" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* History Filters */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "12px 16px",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {isSuperAdmin && (
              <select
                value={historyShopFilter}
                onChange={(e) => setHistoryShopFilter(e.target.value)}
                className="pos-input"
                style={{ height: "36px", fontSize: "13px", width: "auto" }}
              >
                <option value="ALL">All Branches</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            )}

            <select
              value={historyModeFilter}
              onChange={(e) => setHistoryModeFilter(e.target.value as any)}
              className="pos-input"
              style={{ height: "36px", fontSize: "13px", width: "auto" }}
            >
              <option value="ALL">All Modes (Quick & Formal)</option>
              <option value="QUICK">Quick Transfers Only</option>
              <option value="FORMAL">Formal Transfers Only</option>
            </select>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              overflow: "hidden",
            }}
          >
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
                No transfers found matching filter criteria.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Transfer #</th>
                      <th>Mode</th>
                      <th>Origin</th>
                      <th>Destination</th>
                      <th className="num">Units</th>
                      <th>Dispatched at / by</th>
                      <th>Status</th>
                      <th>Received at / by</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((t) => {
                      const isQuick = t.mode === "QUICK";
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{t.transferNumber}</td>
                          <td>
                            <span
                              className={`badge ${isQuick ? "badge-primary" : "badge-neutral"}`}
                              style={{ fontSize: "11px", fontWeight: "700" }}
                            >
                              {isQuick ? "Quick" : "Formal"}
                            </span>
                          </td>
                          <td>{shops.find((s) => s.id === t.sourceShopId)?.name || t.sourceShopId}</td>
                          <td>{shops.find((s) => s.id === t.destinationShopId)?.name || t.destinationShopId}</td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {t.totalQuantity}
                          </td>
                          <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                            {formatDate(t.dispatchedAt)} &bull; {t.dispatchedBy}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                t.status === "RECEIVED"
                                  ? "badge-success"
                                  : t.status === "IN_TRANSIT"
                                  ? "badge-warning"
                                  : "badge-neutral"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                            {t.receivedAt ? `${formatDate(t.receivedAt)} • ${t.receivedBy}` : "-"}
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const sShop = shops.find((s) => s.id === t.sourceShopId) || activeShop;
                                const dShop = shops.find((s) => s.id === t.destinationShopId) || activeShop;
                                const noteHTML = renderTransferNoteHTML(t, sShop, dShop);
                                openPrintModal(`Transfer Note — ${t.transferNumber}`, noteHTML);
                              }}
                              style={{ height: "32px", fontSize: "12px", padding: "0 8px" }}
                              title="Print Note"
                            >
                              <Printer size={14} />
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
        </div>
      )}

      {/* ── MODAL: CONFIRM QUICK TRANSFER ── */}
      {isConfirmModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "460px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Confirm Quick Stock Transfer
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "14px 0 20px", lineHeight: "1.5" }}>
              <strong>{sourceShop.name}</strong> to <strong>{destShop.name}</strong>:{" "}
              <strong>{quickTransferItems.length} items, {totalQuickUnits} units</strong>.
              <br />
              <span style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "6px", display: "block" }}>
                Stock will be immediately deducted from {sourceShop.name} and added to {destShop.name}. Total company stock remains unchanged.
              </span>
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => setIsConfirmModalOpen(false)}
                style={{ height: "42px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleExecuteQuickTransfer}
                style={{ height: "42px", padding: "0 20px" }}
              >
                {isSubmitting ? "Processing..." : "Confirm & Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FORMAL DISPATCH MODAL ── */}
      {isDispatchModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Dispatch Formal Stock Transfer
              </h3>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="var(--ink-3)" />
              </button>
            </div>

            <form onSubmit={handleFormalDispatch} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="pos-label">Origin branch</label>
                  <input
                    type="text"
                    disabled
                    value={`${activeShop.name} (${activeShop.code})`}
                    className="pos-input"
                    style={{ height: "42px", background: "var(--surface-sunken)" }}
                  />
                </div>
                <div>
                  <label className="pos-label">Destination branch</label>
                  <select
                    value={formalDestShopId}
                    onChange={(e) => setFormalDestShopId(e.target.value)}
                    className="pos-input"
                    style={{ height: "42px" }}
                  >
                    {shops
                      .filter((s) => s.id !== activeShop.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="pos-label" style={{ margin: 0 }}>Transfer items</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddFormalLine}
                    style={{ height: "30px", fontSize: "12px" }}
                  >
                    <Plus size={14} /> Add variant
                  </button>
                </div>

                <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formalTransferLines.map((line, idx) => {
                    const variant = allVariants.find((v) => v.id === line.variantId);
                    const onHand = variant ? sourceStockMap[variant.id] || 0 : 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          background: "var(--surface-sunken)",
                          padding: "8px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        <select
                          value={line.variantId}
                          onChange={(e) => handleUpdateFormalLine(idx, e.target.value, line.quantity)}
                          className="pos-input"
                          style={{ height: "38px", flex: 1 }}
                        >
                          {allVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.productNameCache} - {v.colorNameCache} (Size: {v.sizeLabelCache}) [Avail: {sourceStockMap[v.id] || 0}]
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          max={onHand}
                          value={line.quantity}
                          onChange={(e) => handleUpdateFormalLine(idx, line.variantId, parseInt(e.target.value) || 1)}
                          className="pos-input"
                          style={{ width: "70px", height: "38px", textAlign: "center" }}
                        />

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveFormalLine(idx)}
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsDispatchModalOpen(false)}
                  style={{ height: "42px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || formalTransferLines.length === 0}
                  style={{ height: "42px" }}
                >
                  {isSubmitting ? "Dispatching..." : "Dispatch transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FORMAL RECEIVE MODAL ── */}
      {selectedTransferToReceive && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Receive Stock Transfer #{selectedTransferToReceive.transferNumber}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "10px 0 16px" }}>
              Verify physical shoe counts before accepting stock into <strong>{activeShop.name}</strong>.
            </p>

            <div style={{ background: "var(--surface-sunken)", padding: "12px", borderRadius: "8px", marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)", marginBottom: "6px" }}>MANIFEST ITEMS</div>
              {selectedTransferToReceive.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0" }}>
                  <span>{it.variantDescriptionCache}</span>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{it.dispatchedQuantity} pairs</strong>
                </div>
              ))}
            </div>

            <div>
              <label className="pos-label">Discrepancy / Reception notes (optional)</label>
              <textarea
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="Log any damaged boxes or physical counting differences..."
                className="pos-input"
                style={{ height: "70px", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => setSelectedTransferToReceive(null)}
                style={{ height: "42px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleFormalReceive}
                style={{ height: "42px" }}
              >
                {isSubmitting ? "Receiving..." : "Confirm & Receive Stock"}
              </button>
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
            handleScanBarcode(code);
          }}
        />
      )}
    </div>
  );
}
