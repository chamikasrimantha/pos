// src/components/transfers/TransfersView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getTransfers,
  dispatchTransfer,
  receiveTransfer,
  getVariants,
  getInventoryForShop,
} from "@/lib/firestore-service";
import { formatDate, renderTransferDispatchNoteHTML } from "@/lib/receipt-generator";
import { StockTransfer, ProductVariant } from "@/types";
import {
  ArrowLeftRight,
  Send,
  CheckCircle2,
  Boxes,
  Printer,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Truck,
} from "lucide-react";

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

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [destShopId, setDestShopId] = useState<string>(
    activeShop.id === "rightway" ? "mega" : "rightway"
  );
  const [transferLines, setTransferLines] = useState<
    { variantId: string; quantity: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receive modal state
  const [selectedTransferToReceive, setSelectedTransferToReceive] = useState<StockTransfer | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState("");

  const allVariants = useMemo(() => getVariants(), [dataVersion]);
  const currentShopInventory = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);

  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentShopInventory.forEach((i) => {
      map[i.variantId] = i.quantityOnHand;
    });
    return map;
  }, [currentShopInventory]);

  const allTransfers = useMemo(() => getTransfers(), [dataVersion]);

  // Destination shop object
  const otherShops = useMemo(() => {
    return shops.filter((s) => s.id !== activeShop.id);
  }, [shops, activeShop.id]);

  const handleAddLine = () => {
    const available = allVariants.find((v) => !transferLines.some((l) => l.variantId === v.id));
    if (!available) {
      showToast("All variants already added to dispatch list.", "info");
      return;
    }
    setTransferLines((prev) => [...prev, { variantId: available.id, quantity: 1 }]);
  };

  const handleUpdateLine = (index: number, variantId: string, quantity: number) => {
    setTransferLines((prev) =>
      prev.map((line, i) => (i === index ? { variantId, quantity: Math.max(1, quantity) } : line))
    );
  };

  const handleRemoveLine = (index: number) => {
    setTransferLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Dispatch
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLines.length === 0) {
      showToast("Please add at least one shoe variant to dispatch.", "error");
      return;
    }

    const itemsToDispatch: { variant: ProductVariant; quantity: number }[] = [];
    for (const line of transferLines) {
      const v = allVariants.find((item) => item.id === line.variantId);
      if (!v) continue;
      const onHand = stockMap[v.id] || 0;
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
        destinationShopId: destShopId,
        items: itemsToDispatch,
        dispatchedBy: currentUser?.displayName || "Stock Officer",
      });

      showToast(`Transfer #${transfer.transferNumber} dispatched!`, "success");
      setIsDispatchModalOpen(false);
      setTransferLines([]);
      refreshData();

      // Automatically pop Transfer Dispatch Note
      const targetShop = shops.find((s) => s.id === destShopId) || activeShop;
      const noteHTML = renderTransferDispatchNoteHTML(transfer, activeShop, targetShop);
      openPrintModal(`Transfer Dispatch Note — ${transfer.transferNumber}`, noteHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Receive Transfer
  const handleReceive = async () => {
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

  // Enforce Section 5.2: Cashier hidden
  if (currentUser?.role === "CASHIER") {
    return (
      <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            Access Restricted
          </h3>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "8px", lineHeight: "1.5" }}>
            Branch transfers are restricted exclusively to Shop Managers and Super Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Branch Transfers
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Rebalance inventory between branches with in-transit tracking and verification receipts.
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setTransferLines([]);
            setIsDispatchModalOpen(true);
          }}
        >
          <Send size={16} /> Dispatch transfer
        </button>
      </div>

      {/* TRANSFERS TABLE */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)" }}>
            Stock transfer register ({allTransfers.length})
          </h3>
        </div>

        {allTransfers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
            No stock transfers recorded yet. Click &quot;Dispatch transfer&quot; to initiate a transfer between branches.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Origin branch</th>
                  <th>Destination branch</th>
                  <th className="num">Total pairs</th>
                  <th>Dispatched at</th>
                  <th>Dispatched by</th>
                  <th>Status</th>
                  <th>Received at / by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allTransfers.map((tr) => {
                  const isOrigin = tr.sourceShopId === activeShop.id;
                  const isDestination = tr.destinationShopId === activeShop.id;
                  const canReceive = tr.status === "IN_TRANSIT" && isDestination;

                  const srcShop = shops.find((s) => s.id === tr.sourceShopId);
                  const dstShop = shops.find((s) => s.id === tr.destinationShopId);

                  return (
                    <tr key={tr.id}>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{tr.transferNumber}</td>
                      <td>
                        <span style={{ fontWeight: isOrigin ? "600" : "400", color: "var(--ink)" }}>
                          {srcShop?.name || tr.sourceShopId}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: isDestination ? "600" : "400", color: "var(--ink)" }}>
                          {dstShop?.name || tr.destinationShopId}
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{tr.totalQuantity}</td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(tr.dispatchedAt)}</td>
                      <td style={{ color: "var(--ink-2)" }}>{tr.dispatchedBy}</td>
                      <td>
                        <span className={`badge ${tr.status === "RECEIVED" ? "badge-success" : "badge-primary"}`}>
                          {tr.status === "RECEIVED" ? "Received" : "Dispatched"}
                        </span>
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {tr.receivedAt ? `${formatDate(tr.receivedAt)} (${tr.receivedBy})` : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {canReceive && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setSelectedTransferToReceive(tr)}
                            >
                              <CheckCircle2 size={14} /> Receive
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            aria-label="Print transfer note"
                            onClick={() => {
                              const s = srcShop || activeShop;
                              const d = dstShop || activeShop;
                              const noteHTML = renderTransferDispatchNoteHTML(tr, s, d);
                              openPrintModal(`Transfer Note — ${tr.transferNumber}`, noteHTML);
                            }}
                            title="Print transfer note"
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

      {/* DISPATCH NEW TRANSFER MODAL */}
      {isDispatchModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleDispatch}
            className="modal-panel modal-panel-lg animate-fade-in"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Send size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Dispatch stock transfer
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Transfer footwear inventory between branches
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Source & Destination */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "12px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
                <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Origin branch (Source)</div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink)", marginTop: "2px" }}>{activeShop.name}</div>
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Destination branch *
                </label>
                <select
                  className="input-field"
                  value={destShopId}
                  onChange={(e) => setDestShopId(e.target.value)}
                >
                  {otherShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lines items */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>Shoes to dispatch:</div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLine}>
                  <Plus size={14} /> Add shoe line
                </button>
              </div>

              {transferLines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--ink-3)", fontSize: "14px", background: "var(--canvas)", border: "1px dashed var(--line)", borderRadius: "var(--radius-control)" }}>
                  Click &quot;Add shoe line&quot; to select shoes and quantities for transfer.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {transferLines.map((line, idx) => {
                    const selVariant = allVariants.find((v) => v.id === line.variantId);
                    const onHand = selVariant ? stockMap[selVariant.id] || 0 : 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          background: "var(--canvas)",
                          border: "1px solid var(--line)",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-control)",
                        }}
                      >
                        <select
                          className="input-field"
                          style={{ flex: 1, height: "40px", fontSize: "13px" }}
                          value={line.variantId}
                          onChange={(e) => handleUpdateLine(idx, e.target.value, line.quantity)}
                        >
                          {allVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.productNameCache} ({v.colorNameCache}, {v.sizeLabelCache}) [Stock: {stockMap[v.id] || 0}]
                            </option>
                          ))}
                        </select>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max={onHand}
                            className="input-field"
                            style={{ width: "70px", height: "40px", textAlign: "center", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}
                            value={line.quantity}
                            onChange={(e) => handleUpdateLine(idx, line.variantId, parseInt(e.target.value) || 1)}
                          />
                        </div>

                        <button
                          type="button"
                          aria-label="Remove line"
                          onClick={() => handleRemoveLine(idx)}
                          style={{ background: "transparent", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "4px" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsDispatchModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting || transferLines.length === 0}
              >
                <Printer size={16} />
                {isSubmitting ? "Dispatching…" : "Dispatch & print note"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECEIVE & VERIFY TRANSFER MODAL */}
      {selectedTransferToReceive && (
        <div className="modal-backdrop">
          <div
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                  Receive incoming transfer
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Verify incoming items into {activeShop.name}
                </div>
              </div>
              <button
                onClick={() => setSelectedTransferToReceive(null)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "16px", lineHeight: "1.6" }}>
              <div>Transfer: <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{selectedTransferToReceive.transferNumber}</strong></div>
              <div>Total expected pairs: <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{selectedTransferToReceive.totalQuantity}</strong></div>
            </div>

            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-control)", marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>Manifest items:</div>
              {selectedTransferToReceive.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--ink-2)", marginBottom: "4px" }}>
                  <span>{it.variantDescriptionCache}</span>
                  <span style={{ fontWeight: "600", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{it.dispatchedQuantity} pairs</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Discrepancy / condition notes (optional)
              </label>
              <textarea
                rows={2}
                className="input-field"
                placeholder="Note if any boxes are damaged or missing…"
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                style={{ height: "auto", padding: "10px 12px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setSelectedTransferToReceive(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting}
                onClick={handleReceive}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Receiving…" : "Confirm & update stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
