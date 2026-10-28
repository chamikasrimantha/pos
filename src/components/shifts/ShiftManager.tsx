// src/components/shifts/ShiftManager.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  openCashierShift,
  closeCashierShift,
  getShiftHistory,
  recordCashMovement,
  getCashMovementsForShift,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate, renderZReportHTML } from "@/lib/receipt-generator";
import { computeExpectedDrawerCash, computeShiftVariance } from "@/lib/shift-math";
import { CashierShift } from "@/types";
import {
  Coins,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  History,
  TrendingUp,
  TrendingDown,
  Wrench,
  Receipt,
  X,
  PlusCircle,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

export function ShiftManager() {
  const {
    activeShop,
    currentUser,
    activeShift,
    refreshActiveShift,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState<string>("10000");

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<string>("");
  const [varianceReason, setVarianceReason] = useState<string>("");

  // Cash movement modal state (Section 2 G-26, Section 5.4)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<"PAID_IN" | "PAID_OUT" | "SAFE_DROP">("SAFE_DROP");
  const [movementAmount, setMovementAmount] = useState<string>("");
  const [movementReason, setMovementReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shift history: Section 5.2 - Cashier sees own shifts only; Manager & Admin see branch shifts
  const shiftHistory = useMemo(() => {
    const history = getShiftHistory(activeShop.id);
    if (currentUser?.role === "CASHIER") {
      return history.filter((s) => s.cashierId === currentUser.uid);
    }
    return history;
  }, [activeShop.id, currentUser, dataVersion]);

  // Handle Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const floatAmount = parseFloat(openingFloatInput);
    if (isNaN(floatAmount) || floatAmount < 0) {
      showToast("Please enter a valid opening float amount.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const shift = await openCashierShift({
        shopId: activeShop.id,
        cashierId: currentUser.uid,
        cashierName: currentUser.displayName,
        openingFloat: floatAmount,
      });

      showToast(`Shift #${shift.shiftNumber} opened successfully!`, "success");
      setIsOpenShiftModalOpen(false);
      refreshActiveShift();
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to open shift", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Record Cash Movement (Paid-In, Paid-Out, Safe Drop)
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !currentUser) return;
    const amt = parseFloat(movementAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter an amount greater than zero.", "error");
      return;
    }
    if (!movementReason.trim()) {
      showToast("Mandatory: Please provide explanation notes for cash movement.", "error");
      return;
    }

    if (movementType === "PAID_OUT" || movementType === "SAFE_DROP") {
      const currentExpected = computeExpectedDrawerCash(activeShift);
      if (amt > currentExpected) {
        showToast(
          `Cannot remove Rs. ${amt}. Amount exceeds current expected drawer cash of ${formatCurrency(currentExpected)}.`,
          "error"
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await recordCashMovement({
        shiftId: activeShift.id,
        shopId: activeShop.id,
        type: movementType,
        amount: amt,
        reason: movementReason.trim(),
        authorizedBy: currentUser.displayName,
      });

      showToast(`Recorded ${movementType.replace("_", " ")} of ${formatCurrency(amt)}`, "success");
      setIsMovementModalOpen(false);
      setMovementAmount("");
      setMovementReason("");
      refreshActiveShift();
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to record cash movement", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Close Shift & Reconciliation
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const countedAmount = parseFloat(countedCashInput);
    if (isNaN(countedAmount) || countedAmount < 0) {
      showToast("Please enter the physically counted drawer cash total.", "error");
      return;
    }

    const expectedCash = computeExpectedDrawerCash(activeShift);
    const variance = computeShiftVariance(countedAmount, expectedCash);
    if (variance !== 0 && !varianceReason.trim()) {
      showToast("Mandatory: Please provide explanation notes for cash variance.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const closed = await closeCashierShift({
        shiftId: activeShift.id,
        actualCashCounted: countedAmount,
        closingNotes: varianceReason.trim() || undefined,
      });

      showToast(`Shift #${closed.shiftNumber} closed and reconciled!`, "success");
      setIsCloseShiftModalOpen(false);
      setCountedCashInput("");
      setVarianceReason("");
      refreshActiveShift();
      refreshData();

      // Automatically pop Z-Report print preview
      const zHTML = renderZReportHTML(closed, activeShop);
      openPrintModal(`Z-Report — ${closed.shiftNumber}`, zHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to close shift", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentVariance = useMemo(() => {
    if (!countedCashInput || !activeShift) return 0;
    const counted = parseFloat(countedCashInput);
    if (isNaN(counted)) return 0;
    return computeShiftVariance(counted, computeExpectedDrawerCash(activeShift));
  }, [countedCashInput, activeShift]);

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Cash Drawer & Shifts
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Branch: <strong style={{ color: "var(--ink)" }}>{activeShop.name}</strong> ({activeShop.code})
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {activeShift && (currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SHOP_MANAGER") && (
            <button className="btn btn-secondary" onClick={() => setIsMovementModalOpen(true)}>
              <Coins size={16} /> Remove cash
            </button>
          )}
          {!activeShift ? (
            <button className="btn btn-primary" onClick={() => setIsOpenShiftModalOpen(true)}>
              <Unlock size={18} /> Open shift
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsCloseShiftModalOpen(true)}>
              <Lock size={18} /> Close shift
            </button>
          )}
        </div>
      </div>

      {/* CURRENT ACTIVE SHIFT OVERVIEW CARD */}
      {activeShift ? (
        <div
          className="animate-fade-in"
          style={{
            padding: "24px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "var(--primary-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Coins size={22} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--ink)" }}>
                    Shift #{activeShift.shiftNumber}
                  </h3>
                  <span className="badge badge-success">Open</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Cashier: <strong style={{ color: "var(--ink)" }}>{activeShift.cashierNameCache}</strong> · Opened at {formatDate(activeShift.openedAt)}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>
                Expected drawer cash
              </div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
                {formatCurrency(computeExpectedDrawerCash(activeShift))}
              </div>
            </div>
          </div>

          {/* Real-time cash movement metrics in mandatory order */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Opening float</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(activeShift.openingFloat)}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Cash sales</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(activeShift.cashSales)}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Repair cash collected</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(activeShift.repairCashIn || 0)}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Cash refunds</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: (activeShift.cashRefunds || 0) > 0 ? "var(--danger)" : "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                -{formatCurrency(activeShift.cashRefunds || 0)}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Cash removed from the drawer</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: (activeShift.cashPayouts || 0) > 0 ? "var(--warning)" : "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                -{formatCurrency(activeShift.cashPayouts || 0)}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--surface-sunken)", border: "1px solid var(--primary-soft)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--primary)", fontWeight: "600" }}>Expected drawer cash</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(computeExpectedDrawerCash(activeShift))}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Card sales (reconciled)</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(activeShift.cardSales)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="animate-fade-in"
          style={{
            padding: "36px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--surface-sunken)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={26} style={{ color: "var(--ink-3)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--ink)" }}>
              No active shift for current cashier
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", maxWidth: "480px", marginTop: "4px", lineHeight: "1.5" }}>
              To ensure drawer accountability and physical cash security, open a cashier shift with a starting float before selling.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsOpenShiftModalOpen(true)}>
            <Unlock size={18} /> Open shift
          </button>
        </div>
      )}

      {/* SHIFT RECONCILIATION HISTORY TABLE */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "8px" }}>
          <History size={18} style={{ color: "var(--ink-2)" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)" }}>Shift history & Z-reports</h3>
        </div>

        {shiftHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--ink-3)", fontSize: "14px" }}>
            No shifts recorded yet for this branch.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Shift #</th>
                  <th>Cashier</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th className="num">Opening float</th>
                  <th className="num">Cash sales</th>
                  <th className="num">Expected cash</th>
                  <th className="num">Counted cash</th>
                  <th className="num">Variance</th>
                  <th>Status</th>
                  <th>Z-report</th>
                </tr>
              </thead>
              <tbody>
                {shiftHistory.map((s) => {
                  const isClosed = s.status === "CLOSED";
                  const varVal = s.variance || 0;
                  const isBalanced = varVal === 0;

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{s.shiftNumber}</td>
                      <td>{s.cashierNameCache}</td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(s.openedAt)}</td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {s.closedAt ? formatDate(s.closedAt) : "—"}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.openingFloat)}</td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.cashSales)}</td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.expectedCash)}</td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                        {s.actualCashCounted !== undefined ? formatCurrency(s.actualCashCounted) : "—"}
                      </td>
                      <td className="num">
                        {isClosed ? (
                          <span
                            className={`badge ${
                              isBalanced ? "badge-success" : varVal < 0 ? "badge-danger" : "badge-warning"
                            }`}
                          >
                            {isBalanced ? "Balanced" : varVal > 0 ? `+${formatCurrency(varVal)}` : formatCurrency(varVal)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-3)", fontSize: "13px" }}>In progress</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isClosed ? "badge-neutral" : "badge-success"}`}>
                          {isClosed ? "Closed" : "Open"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const zHTML = renderZReportHTML(s, activeShop);
                            openPrintModal(`Z-Report — ${s.shiftNumber}`, zHTML);
                          }}
                          title="Print Z-report"
                        >
                          <Printer size={14} /> Print
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

      {/* OPEN SHIFT MODAL */}
      {isOpenShiftModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleOpenShift}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "440px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>Open shift</h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Count the cash in the drawer before you start.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px", padding: "12px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
              <div>Cashier: <strong style={{ color: "var(--ink)" }}>{currentUser?.displayName || "Cashier"}</strong></div>
              <div>Branch: <strong style={{ color: "var(--ink)" }}>{activeShop.name}</strong></div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Starting cash (float) (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                className="input-field"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                style={{ fontSize: "16px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsOpenShiftModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Opening…" : "Open shift"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CLOSE SHIFT & RECONCILIATION MODAL */}
      {isCloseShiftModalOpen && activeShift && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleCloseShift}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>Close shift</h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Shift #{activeShift.shiftNumber} · Physical cash count & reconciliation
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Expected Summary in exact mandatory order */}
            <div
              style={{
                background: "var(--canvas)",
                border: "1px solid var(--line)",
                padding: "14px",
                borderRadius: "var(--radius-control)",
                marginBottom: "20px",
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-2)" }}>
                <span>Opening float:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(activeShift.openingFloat)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-2)" }}>
                <span>Cash sales:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(activeShift.cashSales)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-2)" }}>
                <span>Repair cash collected:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(activeShift.repairCashIn || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: (activeShift.cashRefunds || 0) > 0 ? "var(--danger)" : "var(--ink-2)" }}>
                <span>Cash refunds:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(activeShift.cashRefunds || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: (activeShift.cashPayouts || 0) > 0 ? "var(--warning)" : "var(--ink-2)" }}>
                <span>Cash removed from the drawer:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(activeShift.cashPayouts || 0)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "700",
                  fontSize: "15px",
                  borderTop: "1px solid var(--line)",
                  paddingTop: "8px",
                  marginTop: "4px",
                  color: "var(--ink)",
                }}
              >
                <span>Expected drawer cash:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(computeExpectedDrawerCash(activeShift))}</span>
              </div>
            </div>

            {/* Actual Physical Count Input */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Counted cash in drawer (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                className="input-field"
                placeholder="Enter physical cash total…"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                style={{ fontSize: "16px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            {/* Computed Variance Alert */}
            {countedCashInput && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-control)",
                  background:
                    currentVariance === 0
                      ? "var(--success-soft)"
                      : currentVariance < 0
                      ? "var(--danger-soft)"
                      : "var(--warning-soft)",
                  border: `1px solid ${
                    currentVariance === 0 ? "var(--success)" : currentVariance < 0 ? "var(--danger)" : "var(--warning)"
                  }`,
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                <span style={{ color: "var(--ink)" }}>Variance:</span>
                <span
                  style={{
                    color:
                      currentVariance === 0 ? "var(--success)" : currentVariance < 0 ? "var(--danger)" : "var(--warning)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {currentVariance === 0
                    ? "Rs. 0.00 (Balanced)"
                    : currentVariance > 0
                    ? `+${formatCurrency(currentVariance)} (Overage)`
                    : `${formatCurrency(currentVariance)} (Shortage)`}
                </span>
              </div>
            )}

            {/* Discrepancy Reason Note (Mandatory if variance != 0) */}
            {countedCashInput && currentVariance !== 0 && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--danger)", display: "block", marginBottom: "6px" }}>
                  Explanation for variance *
                </label>
                <textarea
                  required
                  rows={2}
                  className="input-field"
                  placeholder="Reason for cash discrepancy (e.g., cashier error, voucher)..."
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  style={{ height: "auto", padding: "10px 12px" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsCloseShiftModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting || !countedCashInput}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Closing…" : "Close shift & print Z-report"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CASH MOVEMENT MODAL (Paid-In, Paid-Out, Safe Drop) */}
      {isMovementModalOpen && activeShift && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleRecordMovement}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "460px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                  Record Cash Movement
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Shift #{activeShift.shiftNumber} &bull; {activeShop.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Movement Type *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className={`btn ${movementType === "SAFE_DROP" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "13px", padding: "10px 4px" }}
                  onClick={() => setMovementType("SAFE_DROP")}
                >
                  Safe Drop
                </button>
                <button
                  type="button"
                  className={`btn ${movementType === "PAID_OUT" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "13px", padding: "10px 4px" }}
                  onClick={() => setMovementType("PAID_OUT")}
                >
                  Paid Out
                </button>
                <button
                  type="button"
                  className={`btn ${movementType === "PAID_IN" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "13px", padding: "10px 4px" }}
                  onClick={() => setMovementType("PAID_IN")}
                >
                  Paid In
                </button>
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "6px" }}>
                {movementType === "SAFE_DROP" && "Skim excess cash from till into the store back-office safe."}
                {movementType === "PAID_OUT" && "Petty cash payout for operational store expenses (tea, repairs, stationery)."}
                {movementType === "PAID_IN" && "Replenish till cash or add extra float mid-shift."}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Amount (Rs.) *
              </label>
              <input
                type="number"
                min="1"
                step="50"
                required
                className="input-field"
                placeholder="e.g. 5000"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                style={{ fontSize: "16px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Mandatory Explanation / Reason *
              </label>
              <textarea
                required
                rows={2}
                className="input-field"
                placeholder="Reason for movement (e.g., Safe drop to Colombo safe, Paid courier)..."
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                style={{ height: "auto", padding: "10px 12px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsMovementModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Recording…" : "Confirm Movement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
