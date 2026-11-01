// src/components/reports/ReportsView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getInventoryForShop,
  getRepairOrders,
  getTransfers,
  getSales,
  getDailyCashSummary,
  getSuppliers,
  getSupplierLedger,
  getCheques,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate, renderDailyCashSummaryHTML } from "@/lib/receipt-generator";
import {
  Coins,
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
  const { activeShop, dataVersion, openPrintModal } = useApp();

  const [reportType, setReportType] = useState<"DAILY_SALES" | "DAILY_CASH" | "REPAIRS" | "STOCK">("DAILY_SALES");

  // Load all operational collections for active shop
  const sales = useMemo(() => getSales(activeShop.id), [activeShop.id, dataVersion]);
  const dailyCash = useMemo(() => getDailyCashSummary({ shopId: activeShop.id }), [activeShop.id, dataVersion]);
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

  const totalGrossSales = useMemo(() => {
    return sales.filter((s) => s.status !== "CANCELLED").reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  const totalRefunds = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.returnedAmount || 0), 0);
  }, [sales]);

  const netSales = Math.max(0, totalGrossSales - totalRefunds);

  // CSV Export utility
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (reportType === "DAILY_CASH") {
      csvContent += "Category,Amount\n";
      csvContent += `"Gross Cash Sales",${dailyCash.cashSales}\n`;
      csvContent += `"Repair Cash Collected",${dailyCash.repairCashCollected}\n`;
      csvContent += `"Customer Payments On Account",${dailyCash.cashReceivedOnAccount || 0}\n`;
      csvContent += `"Total Cash Inflow",${dailyCash.totalCashIn}\n`;
      csvContent += `"Cash Refunds",${dailyCash.cashRefunds}\n`;
      csvContent += `"Cash Paid For Purchases",${dailyCash.cashPaidForPurchases || 0}\n`;
      csvContent += `"Cash Advances",${dailyCash.cashAdvancesGiven || 0}\n`;
      csvContent += `"Total Cash Outflow",${dailyCash.totalCashOut}\n`;
      csvContent += `"Net Cash Movement",${dailyCash.netCashMovement}\n`;
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", flexShrink: 0 }}>
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
            Gross: {formatCurrency(totalGrossSales)}
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
      <div className="seg-control" style={{ width: "fit-content", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
        <button
          className={reportType === "DAILY_SALES" ? "active" : ""}
          onClick={() => setReportType("DAILY_SALES")}
        >
          <Calendar size={15} /> Daily sales & reports
        </button>
        <button
          className={reportType === "DAILY_CASH" ? "active" : ""}
          onClick={() => setReportType("DAILY_CASH")}
        >
          <Coins size={15} /> Daily Cash Summary
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
          {reportType === "DAILY_CASH" && (
            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    Today's Cash Movement & Reconciliation
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "4px" }}>
                    Outlet: {activeShop.name} &bull; Derived directly from transactions (Asia/Colombo)
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openPrintModal("Daily Cash Summary - 80mm", renderDailyCashSummaryHTML(dailyCash, activeShop.name, "THERMAL_80MM"))}
                  >
                    Print 80mm
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openPrintModal("Daily Cash Summary - A4", renderDailyCashSummaryHTML(dailyCash, activeShop.name, "A4"))}
                  >
                    Print A4
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "20px" }}>
                <div style={{ padding: "16px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Gross Cash Sales</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(dailyCash.cashSales)}
                  </div>
                </div>
                <div style={{ padding: "16px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Repair Cash Collected</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(dailyCash.repairCashCollected)}
                  </div>
                </div>
                <div style={{ padding: "16px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Cash Refunds</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    -{formatCurrency(dailyCash.cashRefunds)}
                  </div>
                </div>
                <div style={{ padding: "16px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Net Cash Movement</div>
                  <div style={{ fontSize: "20px", fontWeight: "900", color: dailyCash.netCashMovement >= 0 ? "var(--success)" : "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(dailyCash.netCashMovement)}
                  </div>
                </div>
              </div>
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
