// src/components/admin/DayEndStatusView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getDayEndStatusData,
  getShops,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderDayEndStatusReportHTML,
  renderSaleReceiptHTML,
} from "@/lib/receipt-generator";
import {
  getColomboDateParts,
  getColomboDayRange,
  formatColomboDateKey,
} from "@/lib/date-utils";
import {
  CalendarCheck,
  Building2,
  Calendar,
  Printer,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  CreditCard,
  Banknote,
  Receipt,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export function DayEndStatusView() {
  const {
    activeShop,
    currentUser,
    openPrintModal,
    showToast,
    setActiveView,
    dataVersion,
  } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const nowParts = useMemo(() => getColomboDateParts(Date.now()), []);
  const todayDateKey = useMemo(() => formatColomboDateKey(Date.now()), []);

  const [selectedShopId, setSelectedShopId] = useState<string>("ALL");
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayDateKey);

  const allShops = useMemo(() => getShops(), [dataVersion]);

  // Selected date timestamp (midday Asia/Colombo +05:30)
  const selectedDayTimestamp = useMemo(() => {
    return new Date(`${selectedDateKey}T12:00:00+05:30`).getTime();
  }, [selectedDateKey]);

  // Query Day-End Status Data
  const statusData = useMemo(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") return null;
    try {
      return getDayEndStatusData(selectedShopId, selectedDayTimestamp, currentUser);
    } catch (e: any) {
      console.error("DayEndStatus error:", e);
      return null;
    }
  }, [selectedShopId, selectedDayTimestamp, currentUser, dataVersion]);

  const activeShopName = useMemo(() => {
    if (selectedShopId === "ALL") return "All Outlets (Combined)";
    const found = allShops.find((s) => s.id === selectedShopId);
    return found ? found.name : activeShop.name;
  }, [selectedShopId, allShops, activeShop]);

  // Handle Day-End Print
  const handlePrintDayEnd = () => {
    if (!statusData) return;
    try {
      const html = renderDayEndStatusReportHTML(
        statusData,
        activeShopName,
        currentUser?.displayName || "Super Admin"
      );
      openPrintModal(`Day-End Status Audit — ${statusData.dateKey}`, html);
    } catch (e: any) {
      showToast(e.message || "Failed to print day-end status", "error");
    }
  };

  // Guard: If non-super admin somehow enters, show unauthorized block
  if (!isSuperAdmin) {
    return (
      <div className="animate-fade-in" style={{ padding: "40px", textAlign: "center" }}>
        <AlertCircle size={48} style={{ color: "var(--danger)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)" }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--ink-2)", marginTop: "8px" }}>
          Day-end status and sequence integrity auditing is restricted to Super Admin only.
        </p>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in page-responsive-container"
      style={{
        padding: "20px 24px",
        maxWidth: "1500px",
        margin: "0 auto",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CalendarCheck size={24} style={{ color: "var(--primary)" }} />
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
              Day-end Invoice & Sales Audit
            </h1>
          </div>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0" }}>
            Super Admin daily audit: sequential invoice integrity, status breakdown, and daily cash reconciliation.
          </p>
        </div>

        {/* Global Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Outlet Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Building2 size={16} style={{ color: "var(--ink-3)" }} />
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="select"
              style={{ height: "42px", fontSize: "14px", fontWeight: "600" }}
            >
              <option value="ALL">All Outlets (Combined)</option>
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={16} style={{ color: "var(--ink-3)" }} />
            <input
              type="date"
              value={selectedDateKey}
              onChange={(e) => setSelectedDateKey(e.target.value)}
              className="input"
              style={{ height: "42px", fontSize: "14px", fontWeight: "600" }}
            />
          </div>

          {/* Print Day-End Action */}
          <button
            onClick={handlePrintDayEnd}
            disabled={!statusData}
            className="btn btn-primary"
            style={{ height: "42px", display: "flex", alignItems: "center", gap: "8px", padding: "0 18px" }}
          >
            <Printer size={16} />
            <span>Print day-end status</span>
          </button>
        </div>
      </div>

      {statusData && (
        <>
          {/* Status & Alerts Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* Daily Cash Reconciliation Status Card */}
            <div
              className="card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid var(--line)",
                background: "var(--surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Coins size={24} style={{ color: "var(--primary)" }} />
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--ink)" }}>
                    Daily Net Cash Movement
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                    Cash sales + repair cash collected − cash refunds
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--radius-control)",
                  fontSize: "14px",
                  fontWeight: "800",
                  fontVariantNumeric: "tabular-nums",
                  background: (statusData.dailyCashSummary?.netCashMovement || 0) >= 0 ? "var(--success-soft, #f0fdf4)" : "var(--danger-soft, #fef2f2)",
                  color: (statusData.dailyCashSummary?.netCashMovement || 0) >= 0 ? "var(--success)" : "var(--danger)",
                  border: "1px solid currentColor",
                }}
              >
                {formatCurrency(statusData.dailyCashSummary?.netCashMovement || 0)}
              </span>
            </div>

            {/* Sequence Integrity Status Card */}
            <div
              className="card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid var(--line)",
                background: statusData.missingInvoices.length === 0
                  ? "var(--surface)"
                  : "var(--danger-soft, #fef2f2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {statusData.missingInvoices.length === 0 ? (
                  <FileCheck size={24} style={{ color: "var(--primary)" }} />
                ) : (
                  <AlertTriangle size={24} style={{ color: "var(--danger)" }} />
                )}
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--ink)" }}>
                    {statusData.missingInvoices.length === 0
                      ? "Sequence Integrity Verified"
                      : "Sequential Gaps Detected"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                    {statusData.missingInvoices.length === 0
                      ? `Range: ${statusData.firstInvoiceNumber || "None"} → ${statusData.lastInvoiceNumber || "None"}`
                      : `Missing: ${statusData.missingInvoices.join(", ")}`}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-control)",
                  fontSize: "12px",
                  fontWeight: "800",
                  background: statusData.missingInvoices.length === 0 ? "var(--primary-soft)" : "var(--danger)",
                  color: statusData.missingInvoices.length === 0 ? "var(--primary-ink)" : "#fff",
                }}
              >
                {statusData.missingInvoices.length === 0 ? "INTACT" : `${statusData.missingInvoices.length} MISSING`}
              </span>
            </div>
          </div>

          {/* Invoice Counts by Status Tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "14px",
              marginBottom: "24px",
            }}
          >
            <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)" }}>COMPLETED</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--success)", marginTop: "4px" }}>
                {statusData.completedInvoices}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
                Fully paid & fulfilled
              </div>
            </div>

            <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)" }}>PARTIALLY RETURNED</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--warning-ink, #b45309)", marginTop: "4px" }}>
                {statusData.partiallyReturnedInvoices}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
                One or more items refunded
              </div>
            </div>

            <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)" }}>FULLY RETURNED</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--danger)", marginTop: "4px" }}>
                {statusData.fullyReturnedInvoices}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
                Full refund issued
              </div>
            </div>

            <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-3)" }}>CANCELLED</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--ink-3)", marginTop: "4px" }}>
                {statusData.cancelledInvoices}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
                Voided before payment
              </div>
            </div>

            <div className="card" style={{ padding: "16px", border: "1px solid var(--line)", background: "var(--primary-soft)" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-ink)" }}>TOTAL INVOICES</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--primary)", marginTop: "4px" }}>
                {statusData.totalInvoices}
              </div>
              <div style={{ fontSize: "12px", color: "var(--primary-ink)", marginTop: "2px" }}>
                Net Sales: {formatCurrency(statusData.netSales)}
              </div>
            </div>
          </div>

          {/* Daily Cash Movement Card & Cashier Breakdown */}
          <div
            className="card"
            style={{
              padding: "20px",
              marginBottom: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Coins size={20} style={{ color: "var(--primary)" }} />
                <span>Daily Cash Movement & Tender Reconciliation</span>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "900",
                  fontVariantNumeric: "tabular-nums",
                  color: (statusData.dailyCashSummary?.netCashMovement || 0) >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                Net Cash: {formatCurrency(statusData.dailyCashSummary?.netCashMovement || 0)}
              </div>
            </div>

            {/* Inflow vs Outflow grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              <div style={{ padding: "14px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>GROSS CASH SALES</div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(statusData.dailyCashSummary?.cashSales || statusData.payments.cash)}
                </div>
              </div>
              <div style={{ padding: "14px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>REPAIR CASH COLLECTED</div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(statusData.dailyCashSummary?.repairCashCollected || statusData.repairIncome || 0)}
                </div>
              </div>
              <div style={{ padding: "14px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>CASH REFUNDS</div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  -{formatCurrency(statusData.dailyCashSummary?.cashRefunds || 0)}
                </div>
              </div>
              <div style={{ padding: "14px", background: "var(--surface-sunken)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>NET CASH MOVEMENT</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: (statusData.dailyCashSummary?.netCashMovement || 0) >= 0 ? "var(--success)" : "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(statusData.dailyCashSummary?.netCashMovement || 0)}
                </div>
              </div>
            </div>

            {/* Cashier breakdown if multiple */}
            {statusData.dailyCashSummary?.cashierBreakdowns && statusData.dailyCashSummary.cashierBreakdowns.length > 0 && (
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", marginBottom: "10px" }}>Cashier Breakdown</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-muted, #f9fafb)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px" }}>Cashier</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Cash Sales</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Repair Cash</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Cash Refunds</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Net Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusData.dailyCashSummary.cashierBreakdowns.map((cb: any) => (
                        <tr key={cb.cashierId} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "10px 12px", fontWeight: "700" }}>{cb.cashierName}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cb.cashSales)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cb.repairCashCollected)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: cb.cashRefunds > 0 ? "var(--danger)" : "inherit" }}>
                            {cb.cashRefunds > 0 ? `-${formatCurrency(cb.cashRefunds)}` : "Rs. 0.00"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "800", fontVariantNumeric: "tabular-nums", color: cb.netCashMovement >= 0 ? "var(--success)" : "var(--danger)" }}>
                            {formatCurrency(cb.netCashMovement)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sequential Invoices Audit Table */}
          <div
            className="card"
            style={{
              padding: "20px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--ink)" }}>
                  Daily Invoices Log & Sequential Audit ({statusData.sales.length})
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                  Sorted in sequential order for audit verification
                </div>
              </div>

              <button
                onClick={() => setActiveView("invoices")}
                className="btn btn-secondary btn-sm"
                style={{ height: "34px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Receipt size={14} />
                <span>Open Invoices Manager</span>
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted, #f9fafb)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px" }}>Invoice #</th>
                    <th style={{ padding: "10px 12px" }}>Issued At</th>
                    <th style={{ padding: "10px 12px" }}>Cashier</th>
                    <th style={{ padding: "10px 12px" }}>Customer</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Net Total</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Print</th>
                  </tr>
                </thead>
                <tbody>
                  {statusData.sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "var(--ink-3)" }}>
                        No invoices issued on {selectedDateKey}.
                      </td>
                    </tr>
                  ) : (
                    statusData.sales.map((sale) => (
                      <tr key={sale.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: "800" }}>{sale.invoiceNumber}</td>
                        <td style={{ padding: "12px", color: "var(--ink-2)" }}>{formatDate(sale.createdAt)}</td>
                        <td style={{ padding: "12px" }}>{sale.cashierNameCache || "Cashier"}</td>
                        <td style={{ padding: "12px" }}>{sale.customerName || "Walk-in"}</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background:
                                sale.status === "COMPLETED"
                                  ? sale.returnStatus === "PARTIALLY_RETURNED"
                                    ? "var(--warning-soft, #fef3c7)"
                                    : sale.returnStatus === "FULLY_RETURNED"
                                    ? "var(--danger-soft, #fee2e2)"
                                    : "var(--success-soft, #dcfce7)"
                                  : "var(--surface-muted)",
                              color:
                                sale.status === "COMPLETED"
                                  ? sale.returnStatus === "PARTIALLY_RETURNED"
                                    ? "var(--warning-ink, #b45309)"
                                    : sale.returnStatus === "FULLY_RETURNED"
                                    ? "var(--danger)"
                                    : "var(--success)"
                                  : "var(--ink)",
                            }}
                          >
                            {sale.status === "COMPLETED"
                              ? sale.returnStatus === "PARTIALLY_RETURNED"
                                ? "PARTIAL RETURN"
                                : sale.returnStatus === "FULLY_RETURNED"
                                ? "RETURNED"
                                : "COMPLETED"
                              : "CANCELLED"}
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "800" }}>
                          {formatCurrency(sale.total)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <button
                            onClick={() => {
                              const html = renderSaleReceiptHTML(sale, [], activeShop, true);
                              openPrintModal(`Invoice #${sale.invoiceNumber} (DUPLICATE)`, html);
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ height: "30px", width: "30px", padding: 0 }}
                            title="Print duplicate invoice"
                          >
                            <Printer size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
