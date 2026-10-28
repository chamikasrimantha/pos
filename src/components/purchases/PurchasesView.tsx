// src/components/purchases/PurchasesView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getPurchases,
  getSuppliers,
  getVariants,
  createPurchaseOrder,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { ProductVariant } from "@/types";
import { Truck, Plus, Trash2, CheckCircle2, X } from "lucide-react";

export function PurchasesView() {
  const { activeShop, currentUser, showToast, refreshData, dataVersion } = useApp();

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<
    { variantId: string; quantity: number; unitCost: number }[]
  >([]);
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const purchases = useMemo(() => getPurchases(activeShop.id), [activeShop.id, dataVersion]);
  const suppliers = useMemo(() => getSuppliers(), [dataVersion]);
  const allVariants = useMemo(() => getVariants(), [dataVersion]);

  const handleAddLine = () => {
    const available = allVariants.find((v) => !purchaseLines.some((l) => l.variantId === v.id));
    if (!available) {
      showToast("All variants already added to bill.", "info");
      return;
    }
    setPurchaseLines((prev) => [
      ...prev,
      { variantId: available.id, quantity: 10, unitCost: available.referenceCostPrice },
    ]);
  };

  const handleUpdateLine = (index: number, variantId: string, quantity: number, unitCost: number) => {
    setPurchaseLines((prev) =>
      prev.map((line, i) =>
        i === index ? { variantId, quantity: Math.max(1, quantity), unitCost: Math.max(0, unitCost) } : line
      )
    );
  };

  const handleRemoveLine = (index: number) => {
    setPurchaseLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalBillAmount = useMemo(() => {
    return purchaseLines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  }, [purchaseLines]);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      showToast("Please select a footwear supplier.", "error");
      return;
    }
    if (purchaseLines.length === 0) {
      showToast("Please add at least one line item.", "error");
      return;
    }

    const items = purchaseLines.map((l) => {
      const v = allVariants.find((varItem) => varItem.id === l.variantId)!;
      return {
        variant: v,
        quantity: l.quantity,
        unitCost: l.unitCost,
      };
    });

    setIsSubmitting(true);
    try {
      const p = await createPurchaseOrder({
        shopId: activeShop.id,
        supplierId: selectedSupplierId,
        items,
        receivedBy: currentUser?.displayName || "Purchasing Officer",
        notes: purchaseNotes.trim() || undefined,
      });

      showToast(`Purchase #${p.purchaseNumber} recorded! Stock incremented.`, "success");
      setIsPurchaseModalOpen(false);
      setPurchaseLines([]);
      setPurchaseNotes("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to record purchase bill", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = currentUser?.role === "SUPER_ADMIN";
  const canCreate = isAdmin || !!currentUser?.canCreatePurchase;

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
            Purchasing and stock inward logs are restricted to Managers and Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-responsive-container"
      style={{ padding: "24px", paddingBottom: "90px", display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Purchasing & Inward
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            {isAdmin
              ? `Receive shoe shipments from suppliers into ${activeShop.name}, update inventory, and post to ledger.`
              : `Inward shipment log for ${activeShop.name}.`}
          </div>
        </div>

        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedSupplierId(suppliers[0]?.id || "");
              setPurchaseLines([]);
              setIsPurchaseModalOpen(true);
            }}
          >
            <Plus size={18} /> Record purchase bill
          </button>
        )}
      </div>

      {/* PURCHASES HISTORY TABLE */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            {isAdmin ? `Supplier purchase bills (${purchases.length})` : `Inward shipment log (${purchases.length})`}
          </h3>
        </div>

        {purchases.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
            No purchase shipments received yet for this branch.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Purchase #</th>
                  <th>Supplier</th>
                  <th className="num">Total pairs</th>
                  {isAdmin && <th className="num">Bill total</th>}
                  <th>Received date</th>
                  <th>Received by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const pairs = p.items.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{p.purchaseNumber}</td>
                      <td style={{ fontWeight: "600", color: "var(--ink)" }}>{p.supplierNameCache}</td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{pairs} pairs</td>
                      {isAdmin && (
                        <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.totalAmount)}</td>
                      )}
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(p.receivedAt)}</td>
                      <td style={{ color: "var(--ink-2)" }}>{p.receivedBy}</td>
                      <td>
                        <span className="badge badge-success">Received</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PURCHASE MODAL */}
      {isPurchaseModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleCreatePurchase}
            className="modal-panel modal-panel-lg animate-fade-in"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Truck size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Record inward purchase bill
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Inward stock into {activeShop.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Footwear supplier *
                </label>
                <select
                  required
                  className="input-field"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: "12px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
                <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Destination branch</div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink)", marginTop: "2px" }}>{activeShop.name}</div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>Shipment line items:</div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLine}>
                  <Plus size={14} /> Add shoe line
                </button>
              </div>

              {purchaseLines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--ink-3)", fontSize: "14px", background: "var(--canvas)", border: "1px dashed var(--line)", borderRadius: "var(--radius-control)" }}>
                  Click &quot;Add shoe line&quot; to add products received in this shipment.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {purchaseLines.map((line, idx) => (
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
                        style={{ flex: 2, height: "40px", fontSize: "13px" }}
                        value={line.variantId}
                        onChange={(e) => {
                          const v = allVariants.find((item) => item.id === e.target.value);
                          handleUpdateLine(
                            idx,
                            e.target.value,
                            line.quantity,
                            v ? v.referenceCostPrice : line.unitCost
                          );
                        }}
                      >
                        {allVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.productNameCache} — {v.colorNameCache} ({v.sizeLabelCache})
                          </option>
                        ))}
                      </select>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>Qty:</span>
                        <input
                          type="number"
                          min="1"
                          className="input-field"
                          style={{ width: "70px", height: "40px", textAlign: "center", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}
                          value={line.quantity}
                          onChange={(e) =>
                            handleUpdateLine(idx, line.variantId, parseInt(e.target.value) || 1, line.unitCost)
                          }
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>Cost (Rs.):</span>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          style={{ width: "90px", height: "40px", textAlign: "right", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}
                          value={line.unitCost}
                          onChange={(e) =>
                            handleUpdateLine(idx, line.variantId, line.quantity, parseFloat(e.target.value) || 0)
                          }
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
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                background: "var(--primary-soft)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--primary-soft-line)",
                marginBottom: "24px",
                fontWeight: "600",
                fontSize: "15px",
              }}
            >
              <span style={{ color: "var(--primary-ink)" }}>Total inward cost:</span>
              <span style={{ color: "var(--ink)", fontSize: "20px", fontVariantNumeric: "tabular-nums", fontWeight: "700" }}>{formatCurrency(totalBillAmount)}</span>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsPurchaseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting || purchaseLines.length === 0}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Receiving…" : "Inward stock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
