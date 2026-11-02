// src/components/shifts/ShiftManager.tsx
// Daily Cash Summary View (replaces legacy cashier shift & cash drawer view per CR-02 Section 3)
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { getDailyCashSummary } from "@/lib/firestore-service";
import { formatCurrency, formatDate, renderDailyCashSummaryHTML } from "@/lib/receipt-generator";
import { DailyCashSummary } from "@/types";
import {
  Coins,
  Printer,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileText,
  User,
  CheckCircle2,
} from "lucide-react";

export function ShiftManager() {
  const {
    activeShop,
    currentUser,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const [selectedShopId, setSelectedShopId] = useState<string>(activeShop.id);
  const [printFormat, setPrintFormat] = useState<"THERMAL_80MM" | "A4">("THERMAL_80MM");

  // Derive cash summary directly from transactions
  const summary = useMemo(() => {
    return getDailyCashSummary({
      shopId: isSuperAdmin ? selectedShopId : activeShop.id,
      cashierId: !isSuperAdmin ? currentUser?.uid : undefined,
      cashierName: !isSuperAdmin ? currentUser?.displayName : undefined,
    });
  }, [selectedShopId, activeShop.id, isSuperAdmin, currentUser, dataVersion]);

  const shopDisplayName = useMemo(() => {
    if (selectedShopId === "ALL") return "All Branches (Central)";
    if (selectedShopId === "rightway") return "RightWay Shoes";
    if (selectedShopId === "megashoes") return "Mega Shoes";
    return activeShop.name;
  }, [selectedShopId, activeShop.name]);

  const handlePrint = (mode: "THERMAL_80MM" | "A4") => {
    const html = renderDailyCashSummaryHTML(summary, shopDisplayName, mode);
    openPrintModal(`Daily Cash Summary - ${mode === "A4" ? "A4 Sheet" : "80mm Slip"}`, html);
  };

  return (
    <div className="view-container animate-fade-in" style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Coins size={28} style={{ color: "var(--primary)" }} />
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Daily Cash Summary
            </h1>
          </div>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0 38px" }}>
            {isSuperAdmin
              ? "Real-time cash totals derived from completed sales, returns, and repair payments."
              : `My day cash summary for ${currentUser?.displayName}.`}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={16} style={{ color: "var(--ink-3)" }} />
              <select
                className="input-field"
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                style={{ height: "40px", fontSize: "14px" }}
              >
                <option value="ALL">All Branches (Central)</option>
                <option value="rightway">RightWay Shoes</option>
                <option value="megashoes">Mega Shoes</option>
              </select>
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handlePrint("THERMAL_80MM")}
            style={{ height: "40px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Printer size={16} /> Print 80mm Slip
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => handlePrint("A4")}
            style={{ height: "40px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileText size={16} /> Print A4 Sheet
          </button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {/* Net Cash Movement */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink-2)", textTransform: "uppercase" }}>
              Net Cash Movement
            </span>
            <Coins size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "800",
              color: summary.netCashMovement >= 0 ? "var(--success)" : "var(--danger)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(summary.netCashMovement)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Total cash in minus total cash out
          </div>
        </div>

        {/* Total Cash In */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink-2)", textTransform: "uppercase" }}>
              Total Cash Inflow
            </span>
            <TrendingUp size={18} style={{ color: "var(--success)" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "800",
              color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            +{formatCurrency(summary.totalCashIn)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Sales ({summary.salesCount}) + Repairs ({summary.repairsCount})
          </div>
        </div>

        {/* Total Cash Out */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink-2)", textTransform: "uppercase" }}>
              Total Cash Outflow
            </span>
            <TrendingDown size={18} style={{ color: "var(--danger)" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "800",
              color: summary.totalCashOut > 0 ? "var(--danger)" : "var(--ink)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            -{formatCurrency(summary.totalCashOut)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Refunds ({summary.refundsCount}) + Cash purchases
          </div>
        </div>
      </div>

      {/* Detailed Inflow / Outflow Breakdown Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        {/* Inflow Panel */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
            <TrendingUp size={18} style={{ color: "var(--success)" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Cash Inflow Breakdown
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Gross Cash Sales ({summary.salesCount} transactions)</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {formatCurrency(summary.cashSales)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Shoe Repair Cash Collected ({summary.repairsCount} jobs)</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {formatCurrency(summary.repairCashCollected)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Customer Payments on Account</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {formatCurrency(summary.cashReceivedOnAccount || 0)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "15px",
                fontWeight: "800",
                borderTop: "1px solid var(--line)",
                paddingTop: "10px",
                marginTop: "4px",
                color: "var(--success)",
              }}
            >
              <span>Total Cash In</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>+{formatCurrency(summary.totalCashIn)}</span>
            </div>
          </div>
        </div>

        {/* Outflow Panel */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
            <TrendingDown size={18} style={{ color: "var(--danger)" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Cash Outflow Breakdown
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Customer Cash Refunds ({summary.refundsCount} returns)</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--danger)" }}>
                -{formatCurrency(summary.cashRefunds)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Cash Paid for Purchases ({summary.purchasesCount || 0} bills)</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: summary.cashPaidForPurchases > 0 ? "var(--danger)" : "var(--ink)" }}>
                -{formatCurrency(summary.cashPaidForPurchases || 0)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
              <span style={{ color: "var(--ink-2)" }}>Cash Advances Given</span>
              <span style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: summary.cashAdvancesGiven > 0 ? "var(--danger)" : "var(--ink)" }}>
                -{formatCurrency(summary.cashAdvancesGiven || 0)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "15px",
                fontWeight: "800",
                borderTop: "1px solid var(--line)",
                paddingTop: "10px",
                marginTop: "4px",
                color: summary.totalCashOut > 0 ? "var(--danger)" : "var(--ink)",
              }}
            >
              <span>Total Cash Out</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(summary.totalCashOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cashier Breakdown Table (Shown when viewing all or branch without single cashier filter) */}
      {summary.cashierBreakdowns && summary.cashierBreakdowns.length > 0 && (
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <User size={18} style={{ color: "var(--primary)" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              Cashier Performance Breakdown
            </h3>
          </div>

          <div className="pos-table-container">
            <div className="pos-table-scroll">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th className="num">Cash Sales</th>
                    <th className="num">Repair Cash</th>
                    <th className="num">Cash Refunds</th>
                    <th className="num">Net Cash</th>
                    <th style={{ textAlign: "center" }}>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.cashierBreakdowns.map((cb: DailyCashSummary) => (
                    <tr key={cb.cashierId}>
                      <td style={{ fontWeight: "700" }}>{cb.cashierName}</td>
                      <td className="num">
                        {formatCurrency(cb.cashSales)}
                      </td>
                      <td className="num">
                        {formatCurrency(cb.repairCashCollected)}
                      </td>
                      <td
                        className="num"
                        style={{
                          color: cb.cashRefunds > 0 ? "var(--danger)" : "var(--ink)",
                        }}
                      >
                        {cb.cashRefunds > 0 ? `-${formatCurrency(cb.cashRefunds)}` : "Rs. 0.00"}
                      </td>
                      <td
                        className="num"
                        style={{
                          fontWeight: "800",
                          color: cb.netCashMovement >= 0 ? "var(--success)" : "var(--danger)",
                        }}
                      >
                        {formatCurrency(cb.netCashMovement)}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--ink-2)" }}>
                        {cb.salesCount + cb.refundsCount + cb.repairsCount} ops
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DailyCashSummaryView = ShiftManager;
