// src/components/reports/ReportsView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getInventoryForShop,
  getRepairOrders,
  getTransfers,
  getShiftHistory,
  getSuppliers,
  getSupplierLedger,
  getCheques,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { computeExpectedDrawerCash } from "@/lib/shift-math";
import {
  BarChart3,
  TrendingUp,
  Wrench,
  ArrowLeftRight,
  Boxes,
  Building2,
  Download,
  Calendar,
} from "lucide-react";
import { DailySalesView } from "./DailySalesView";

export function ReportsView() {
  const { activeShop, dataVersion } = useApp();

  const [reportType, setReportType] = useState<"DAILY_SALES" | "SALES" | "SHIFTS" | "REPAIRS" | "STOCK">("DAILY_SALES");

  // Load all operational collections for active shop
  const shifts = useMemo(() => getShiftHistory(activeShop.id), [activeShop.id, dataVersion]);
  const repairs = useMemo(() => getRepairOrders(activeShop.id), [activeShop.id, dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);
  const transfers = useMemo(() => getTransfers(), [dataVersion]);
  const suppliers = useMemo(() => getSuppliers(), [dataVersion]);
  const cheques = useMemo(() => getCheques(), [dataVersion]);

  // Aggregate stats
  const totalPhysicalPairs = useMemo(() => {
    return inventoryList.reduce((sum, inv) => sum + inv.quantityOnHand, 0);
  }, [inventoryList]);

  const activeRepairsCount = useMemo(() => {
    return repairs.filter((r) => r.status !== "DELIVERED" && r.status !== "CANCELLED").length;
  }, [repairs]);

  const inTransitPairs = useMemo(() => {
    return transfers
      .filter((t) => t.status === "IN_TRANSIT")
      .reduce((sum, t) => sum + t.totalQuantity, 0);
  }, [transfers]);

  const totalChequeExposure = useMemo(() => {
    return cheques
      .filter((c) => c.status === "PENDING")
      .reduce((sum, c) => sum + c.amount, 0);
  }, [cheques]);

  const totalSupplierBalance = useMemo(() => {
    return suppliers.reduce((sum, sup) => {
      const { outstandingBalance } = getSupplierLedger(sup.id);
      return sum + outstandingBalance;
    }, 0);
  }, [suppliers, dataVersion]);

  const totalShiftSales = useMemo(() => {
    return shifts.reduce((sum, s) => sum + s.cashSales + s.cardSales + s.transferSales, 0);
  }, [shifts]);

  const totalShiftRefunds = useMemo(() => {
    return shifts.reduce((sum, s) => sum + (s.cashRefunds || 0), 0);
  }, [shifts]);

  const netSales = Math.max(0, totalShiftSales - totalShiftRefunds);

  // CSV Export utility
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (reportType === "SALES" || reportType === "SHIFTS") {
      csvContent += "ShiftNumber,Cashier,OpenedAt,ClosedAt,OpeningFloat,CashSales,CardSales,Refunds,ExpectedCash,CountedCash,Variance,Status\n";
      shifts.forEach((s) => {
        csvContent += `"${s.shiftNumber}","${s.cashierNameCache}","${formatDate(s.openedAt)}","${
          s.closedAt ? formatDate(s.closedAt) : "OPEN"
        }",${s.openingFloat},${s.cashSales},${s.cardSales},${s.cashRefunds || 0},${computeExpectedDrawerCash(s)},${
          s.actualCashCounted || 0
        },${s.variance || 0},"${s.status}"\n`;
      });
    } else if (reportType === "REPAIRS") {
      csvContent += "RepairNumber,Customer,Phone,ShoeBrand,Status,EstimatedCost,AdvancePaid,BalanceDue,PromisedDate\n";
      repairs.forEach((r) => {
        csvContent += `"${r.repairNumber}","${r.customerName}","${r.customerPhone}","${r.shoeBrand}","${r.status}",${r.estimatedCost},${r.advancePaid},${r.balanceDue},"${formatDate(r.promisedDate)}"\n`;
      });
    } else {
      csvContent += "VariantId,QuantityOnHand,ReorderLevel\n";
      inventoryList.forEach((inv) => {
        csvContent += `"${inv.variantId}",${inv.quantityOnHand},${inv.reorderLevel}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apex_pos_report_${reportType.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Analytics & reports
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Operational metrics and performance summaries for {activeShop.name}.
          </div>
        </div>

        <button className="btn btn-secondary" onClick={handleExportCSV}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* KPI TILES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
        {/* Net Sales */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>Branch net sales</span>
            <TrendingUp size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", marginTop: "8px", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(netSales)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Gross: {formatCurrency(totalShiftSales)}
          </div>
        </div>

        {/* Physical Stock */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>Stock on hand</span>
            <Boxes size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", marginTop: "8px", fontVariantNumeric: "tabular-nums" }}>
            {totalPhysicalPairs} pairs
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Across all shoe variants
          </div>
        </div>

        {/* Active Repairs */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>Active repairs</span>
            <Wrench size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", marginTop: "8px", fontVariantNumeric: "tabular-nums" }}>
            {activeRepairsCount} jobs
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Pending or in workshop
          </div>
        </div>

        {/* In-Transit Pairs */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>In-transit pairs</span>
            <ArrowLeftRight size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", marginTop: "8px", fontVariantNumeric: "tabular-nums" }}>
            {inTransitPairs} pairs
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Between branch dispatches
          </div>
        </div>

        {/* Supplier Liability */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)", fontWeight: "500" }}>Supplier payables</span>
            <Building2 size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", marginTop: "8px", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(totalSupplierBalance)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
            Pending cheques: {formatCurrency(totalChequeExposure)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg-control" style={{ width: "fit-content" }}>
        <button
          className={reportType === "DAILY_SALES" ? "active" : ""}
          onClick={() => setReportType("DAILY_SALES")}
        >
          <Calendar size={15} /> Daily sales & reports
        </button>
        <button
          className={reportType === "SALES" ? "active" : ""}
          onClick={() => setReportType("SALES")}
        >
          <BarChart3 size={15} /> Shift sales & reconciliation
        </button>
        <button
          className={reportType === "REPAIRS" ? "active" : ""}
          onClick={() => setReportType("REPAIRS")}
        >
          <Wrench size={15} /> Shoe repairs
        </button>
        <button
          className={reportType === "STOCK" ? "active" : ""}
          onClick={() => setReportType("STOCK")}
        >
          <Boxes size={15} /> Inventory status
        </button>
      </div>

      {reportType === "DAILY_SALES" && (
        <div style={{ marginTop: "16px" }}>
          <DailySalesView />
        </div>
      )}

      {/* Report Tables */}
      {reportType !== "DAILY_SALES" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            overflow: "hidden",
          }}
        >
          {reportType === "SALES" && (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Shift #</th>
                  <th>Cashier</th>
                  <th>Opened</th>
                  <th className="num">Opening float</th>
                  <th className="num">Cash sales</th>
                  <th className="num">Card sales</th>
                  <th className="num">Refunds</th>
                  <th className="num">Net inflow</th>
                  <th className="num">Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{s.shiftNumber}</td>
                    <td>{s.cashierNameCache}</td>
                    <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(s.openedAt)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.openingFloat)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.cashSales)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.cardSales)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(s.cashRefunds || 0)}</td>
                    <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(s.cashSales + s.cardSales + s.transferSales - (s.cashRefunds || 0))}
                    </td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                      <span className={`badge ${(s.variance || 0) === 0 ? "badge-success" : "badge-danger"}`}>
                        {s.variance !== undefined ? formatCurrency(s.variance) : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.status === "CLOSED" ? "badge-neutral" : "badge-success"}`}>
                        {s.status === "CLOSED" ? "Closed" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === "REPAIRS" && (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Repair #</th>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Shoe description</th>
                  <th>Intake date</th>
                  <th className="num">Estimated fee</th>
                  <th className="num">Advance paid</th>
                  <th className="num">Balance due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{r.repairNumber}</td>
                    <td style={{ fontWeight: "500" }}>{r.customerName}</td>
                    <td style={{ color: "var(--ink-2)" }}>{r.customerPhone}</td>
                    <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                      {r.shoeBrand} {r.shoeModel} ({r.shoeColor}, size {r.shoeSize})
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{formatDate(r.receivedAt)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(r.estimatedCost)}</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(r.advancePaid)}</td>
                    <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(r.balanceDue)}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === "STOCK" && (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Variant ID</th>
                  <th className="num">On hand qty</th>
                  <th className="num">Reorder alert level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryList.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{inv.variantId}</td>
                    <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{inv.quantityOnHand} pairs</td>
                    <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{inv.reorderLevel}</td>
                    <td>
                      <span
                        className={`badge ${
                          inv.quantityOnHand <= 0
                            ? "badge-danger"
                            : inv.quantityOnHand <= inv.reorderLevel
                            ? "badge-amber"
                            : "badge-success"
                        }`}
                      >
                        {inv.quantityOnHand <= 0 ? "Depleted" : inv.quantityOnHand <= inv.reorderLevel ? "Low stock" : "In stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
