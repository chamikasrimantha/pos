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
  getPurchases,
  getShops,
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
  Truck,
  Filter,
} from "lucide-react";
import { DailySalesView } from "./DailySalesView";

export function ReportsView() {
  const { activeShop, currentUser, dataVersion, openPrintModal } = useApp();

  const [reportType, setReportType] = useState<
    "DAILY_SALES" | "DAILY_CASH" | "TRANSFERS" | "PURCHASES" | "REPAIRS" | "STOCK"
  >("DAILY_SALES");

  // Filters state
  const [transferModeFilter, setTransferModeFilter] = useState<"ALL" | "QUICK" | "FORMAL">("ALL");
  const [transferStatusFilter, setTransferStatusFilter] = useState<string>("ALL");
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState<string>("ALL");
  const [purchaseMethodFilter, setPurchaseMethodFilter] = useState<string>("ALL");
  const [purchaseBranchFilter, setPurchaseBranchFilter] = useState<string>("ALL");
  const [repairTypeFilter, setRepairTypeFilter] = useState<"ALL" | "FOOTWEAR" | "BAG">("ALL");
  const [repairWarrantyFilter, setRepairWarrantyFilter] = useState<"ALL" | "WARRANTY" | "PAID" | "UNVERIFIED">("ALL");
  const [stockBranchFilter, setStockBranchFilter] = useState<string>(activeShop.id);

  const allShops = useMemo(() => getShops(), [dataVersion]);

  // Load operational collections
  const sales = useMemo(() => getSales(activeShop.id), [activeShop.id, dataVersion]);
  const dailyCash = useMemo(() => getDailyCashSummary({ shopId: activeShop.id }), [activeShop.id, dataVersion]);
  const repairs = useMemo(() => getRepairOrders(activeShop.id), [activeShop.id, dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(stockBranchFilter), [stockBranchFilter, dataVersion]);
  const transfers = useMemo(() => getTransfers(), [dataVersion]);
  const suppliers = useMemo(() => getSuppliers(), [dataVersion]);
  const cheques = useMemo(() => getCheques(), [dataVersion]);
  const purchases = useMemo(() => getPurchases(undefined, currentUser), [currentUser, dataVersion]);

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

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (transferModeFilter !== "ALL") {
        const mode = t.mode || "FORMAL";
        if (mode !== transferModeFilter) return false;
      }
      if (transferStatusFilter !== "ALL") {
        if (t.status !== transferStatusFilter) return false;
      }
      return true;
    });
  }, [transfers, transferModeFilter, transferStatusFilter]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (purchaseSupplierFilter !== "ALL" && p.supplierId !== purchaseSupplierFilter) return false;
      if (purchaseMethodFilter !== "ALL" && (p.paymentMethod || "CASH") !== purchaseMethodFilter) return false;
      if (purchaseBranchFilter !== "ALL" && p.shopId !== purchaseBranchFilter) return false;
      return true;
    });
  }, [purchases, purchaseSupplierFilter, purchaseMethodFilter, purchaseBranchFilter]);

  // Filtered repairs
  const filteredRepairs = useMemo(() => {
    return repairs.filter((r) => {
      if (repairTypeFilter !== "ALL") {
        const itemType = r.itemType || "FOOTWEAR";
        if (itemType !== repairTypeFilter) return false;
      }
      if (repairWarrantyFilter === "WARRANTY") {
        if (!r.isWarranty) return false;
      } else if (repairWarrantyFilter === "PAID") {
        if (r.isWarranty) return false;
      } else if (repairWarrantyFilter === "UNVERIFIED") {
        if (!r.isWarranty || r.warrantyStatus !== "UNVERIFIED") return false;
      }
      return true;
    });
  }, [repairs, repairTypeFilter, repairWarrantyFilter]);

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
    } else if (reportType === "TRANSFERS") {
      csvContent += "TransferNumber,Mode,SourceShop,DestinationShop,Quantity,Status,DispatchedAt\n";
      filteredTransfers.forEach((t) => {
        csvContent += `"${t.transferNumber}","${t.mode || "FORMAL"}","${t.sourceShopId}","${t.destinationShopId}",${t.totalQuantity},"${t.status}","${formatDate(t.dispatchedAt)}"\n`;
      });
    } else if (reportType === "PURCHASES") {
      csvContent += "PurchaseNumber,Supplier,Branch,PaymentMethod,TotalAmount,PaidAmount,ReceivedBy,Date\n";
      filteredPurchases.forEach((p) => {
        csvContent += `"${p.purchaseNumber}","${p.supplierNameCache}","${p.shopId}","${p.paymentMethod || "CASH"}",${p.totalAmount},${p.paidAmount || 0},"${p.createdByNameCache || p.receivedBy}","${formatDate(p.invoiceDate || p.receivedAt)}"\n`;
      });
    } else if (reportType === "REPAIRS") {
      csvContent += "RepairNumber,Customer,Phone,ItemType,Description,Warranty,EstimatedFee,AdvancePaid,BalanceDue,Status\n";
      filteredRepairs.forEach((r) => {
        csvContent += `"${r.repairNumber}","${r.customerName}","${r.customerPhone}","${r.itemType || "FOOTWEAR"}","${r.shoeBrand} ${r.shoeModel || ""}","${r.isWarranty ? (r.warrantyStatus || "WARRANTY") : "PAID"}",${r.estimatedCost},${r.advancePaid},${r.balanceDue},"${r.status}"\n`;
      });
    } else {
      csvContent += "VariantId,Branch,QuantityOnHand,ReorderLevel\n";
      inventoryList.forEach((inv) => {
        csvContent += `"${inv.variantId}","${inv.shopId}",${inv.quantityOnHand},${inv.reorderLevel}\n`;
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
            Operational metrics, branch transfers, purchases, and performance summaries.
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
            Branch: {stockBranchFilter}
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
          className={reportType === "TRANSFERS" ? "active" : ""}
          onClick={() => setReportType("TRANSFERS")}
        >
          <ArrowLeftRight size={15} /> Transfers ({transfers.length})
        </button>
        <button
          className={reportType === "PURCHASES" ? "active" : ""}
          onClick={() => setReportType("PURCHASES")}
        >
          <Truck size={15} /> Purchases ({purchases.length})
        </button>
        <button
          className={reportType === "REPAIRS" ? "active" : ""}
          onClick={() => setReportType("REPAIRS")}
        >
          <Wrench size={15} /> Repairs ({repairs.length})
        </button>
        <button
          className={reportType === "STOCK" ? "active" : ""}
          onClick={() => setReportType("STOCK")}
        >
          <Boxes size={15} /> Stock by branch
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

          {/* Transfers Report (Section 10.2) */}
          {reportType === "TRANSFERS" && (
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    Branch Transfers Audit Report
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Auditing both Quick transfers (immediate) and Formal transfers (dispatch/receive)
                  </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Mode:</span>
                    <select
                      className="select"
                      value={transferModeFilter}
                      onChange={(e) => setTransferModeFilter(e.target.value as any)}
                      style={{ height: "36px", fontSize: "13px" }}
                    >
                      <option value="ALL">All Modes</option>
                      <option value="QUICK">Quick Transfer</option>
                      <option value="FORMAL">Formal Transfer</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Status:</span>
                    <select
                      className="select"
                      value={transferStatusFilter}
                      onChange={(e) => setTransferStatusFilter(e.target.value)}
                      style={{ height: "36px", fontSize: "13px" }}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="RECEIVED">Received / Completed</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="DISPATCHED">Dispatched</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="pos-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Transfer #</th>
                      <th>Mode</th>
                      <th>From Outlet</th>
                      <th>To Outlet</th>
                      <th className="num">Pairs</th>
                      <th>Dispatched By</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                          No transfers match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransfers.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{t.transferNumber}</td>
                          <td>
                            <span className={`badge ${t.mode === "QUICK" ? "badge-primary" : "badge-neutral"}`}>
                              {t.mode === "QUICK" ? "QUICK" : "FORMAL"}
                            </span>
                          </td>
                          <td>{t.sourceShopId}</td>
                          <td>{t.destinationShopId}</td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{t.totalQuantity}</td>
                          <td>{t.dispatchedBy}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDate(t.dispatchedAt)}</td>
                          <td>
                            <span className={`badge ${t.status === "RECEIVED" ? "badge-success" : t.status === "IN_TRANSIT" ? "badge-warning" : "badge-neutral"}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Purchases Report (Section 10.2) */}
          {reportType === "PURCHASES" && (
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    Purchasing & Supplier Inward Report
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Filtered by supplier, outlet branch, and settlement payment method
                  </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    className="select"
                    value={purchaseSupplierFilter}
                    onChange={(e) => setPurchaseSupplierFilter(e.target.value)}
                    style={{ height: "36px", fontSize: "13px" }}
                  >
                    <option value="ALL">All Suppliers</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  <select
                    className="select"
                    value={purchaseBranchFilter}
                    onChange={(e) => setPurchaseBranchFilter(e.target.value)}
                    style={{ height: "36px", fontSize: "13px" }}
                  >
                    <option value="ALL">All Branches</option>
                    {allShops.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name}</option>
                    ))}
                  </select>

                  <select
                    className="select"
                    value={purchaseMethodFilter}
                    onChange={(e) => setPurchaseMethodFilter(e.target.value)}
                    style={{ height: "36px", fontSize: "13px" }}
                  >
                    <option value="ALL">All Methods</option>
                    <option value="CASH">Cash Bill</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT">Credit</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="PARTIAL">Part Payment</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="pos-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Purchase #</th>
                      <th>Supplier</th>
                      <th>Branch</th>
                      <th>Method</th>
                      <th className="num">Bill Total</th>
                      <th className="num">Paid Now</th>
                      <th>Received By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                          No purchases match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{p.purchaseNumber}</td>
                          <td style={{ fontWeight: "600" }}>{p.supplierNameCache}</td>
                          <td>{p.shopId}</td>
                          <td>
                            <span className="badge badge-neutral">{p.paymentMethod || "CASH"}</span>
                          </td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(p.totalAmount)}
                          </td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(p.paidAmount || 0)}
                          </td>
                          <td>{p.createdByNameCache || p.receivedBy}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDate(p.invoiceDate || p.receivedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Repairs Report (Section 10.2: Type, warranty, unverified) */}
          {reportType === "REPAIRS" && (
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    Shoe & Bag Repairs Operational Report
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Item type breakdowns, warranty claims, and fee reconciliation
                  </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="select"
                    value={repairTypeFilter}
                    onChange={(e) => setRepairTypeFilter(e.target.value as any)}
                    style={{ height: "36px", fontSize: "13px" }}
                  >
                    <option value="ALL">All Item Types</option>
                    <option value="FOOTWEAR">Footwear Only</option>
                    <option value="BAG">Bags Only</option>
                  </select>

                  <select
                    className="select"
                    value={repairWarrantyFilter}
                    onChange={(e) => setRepairWarrantyFilter(e.target.value as any)}
                    style={{ height: "36px", fontSize: "13px" }}
                  >
                    <option value="ALL">All Services</option>
                    <option value="WARRANTY">Under Warranty (Free)</option>
                    <option value="PAID">Paid Service</option>
                    <option value="UNVERIFIED">Unverified Warranties</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Repair #</th>
                      <th>Type</th>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Item Description</th>
                      <th>Warranty</th>
                      <th>Intake date</th>
                      <th className="num">Estimated fee</th>
                      <th className="num">Advance paid</th>
                      <th className="num">Balance due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRepairs.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                          No repair orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRepairs.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{r.repairNumber}</td>
                          <td>
                            <span className={`badge ${r.itemType === "BAG" ? "badge-primary" : "badge-neutral"}`}>
                              {r.itemType || "FOOTWEAR"}
                            </span>
                          </td>
                          <td style={{ fontWeight: "500" }}>{r.customerName}</td>
                          <td style={{ color: "var(--ink-2)" }}>{r.customerPhone}</td>
                          <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                            {r.shoeBrand} {r.shoeModel}
                          </td>
                          <td>
                            {r.isWarranty ? (
                              <span className={`badge ${r.warrantyStatus === "VERIFIED" ? "badge-success" : "badge-warning"}`}>
                                {r.warrantyStatus === "VERIFIED" ? "Warranty (Free)" : "Unverified"}
                              </span>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Paid</span>
                            )}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock by Branch Report (Section 10.2) */}
          {reportType === "STOCK" && (
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    Stock by Branch Audit
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Physical inventory levels and reorder alerts across outlets
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>Branch:</span>
                  <select
                    className="select"
                    value={stockBranchFilter}
                    onChange={(e) => setStockBranchFilter(e.target.value)}
                    style={{ height: "36px", fontSize: "13px", fontWeight: "600" }}
                  >
                    {allShops.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name} ({sh.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>Variant ID</th>
                      <th>Outlet Branch</th>
                      <th className="num">On hand qty</th>
                      <th className="num">Reorder alert level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryList.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{inv.variantId}</td>
                        <td>{inv.shopId}</td>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
