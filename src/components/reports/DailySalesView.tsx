// src/components/reports/DailySalesView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getDailySalesData,
  getMonthDailySummary,
  getShops,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderDailySalesReportHTML,
  renderDailyInvoicesBatchHTML,
  renderSaleReceiptHTML,
} from "@/lib/receipt-generator";
import {
  getColomboDateParts,
  getColomboDayRange,
  formatColomboDateKey,
} from "@/lib/date-utils";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileText,
  Layers,
  Building2,
  Eye,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Banknote,
  Receipt,
  X,
  AlertCircle,
} from "lucide-react";

export function DailySalesView() {
  const {
    activeShop,
    currentUser,
    openPrintModal,
    showToast,
    dataVersion,
  } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const nowParts = useMemo(() => getColomboDateParts(Date.now()), []);

  const [selectedShopId, setSelectedShopId] = useState<string>(
    isSuperAdmin ? "ALL" : activeShop.id
  );
  const [year, setYear] = useState<number>(nowParts.year);
  const [month, setMonth] = useState<number>(nowParts.month); // 1-12
  const [selectedDay, setSelectedDay] = useState<number>(nowParts.day);
  const [isMonthPackOpen, setIsMonthPackOpen] = useState(false);

  const allShops = useMemo(() => getShops(), [dataVersion]);

  // Month navigation
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  // Month Summaries for calendar
  const monthSummaries = useMemo(() => {
    return getMonthDailySummary(
      selectedShopId,
      year,
      month,
      isSuperAdmin ? undefined : currentUser || undefined
    );
  }, [selectedShopId, year, month, isSuperAdmin, currentUser, dataVersion]);

  // Selected Day timestamp
  const selectedDayTimestamp = useMemo(() => {
    // Construct midday in Asia/Colombo (+05:30)
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}T12:00:00+05:30`;
    return new Date(dateStr).getTime();
  }, [year, month, selectedDay]);

  // Daily report data
  const dailyData = useMemo(() => {
    return getDailySalesData(
      selectedShopId,
      selectedDayTimestamp,
      isSuperAdmin ? undefined : currentUser || undefined
    );
  }, [selectedShopId, selectedDayTimestamp, isSuperAdmin, currentUser, dataVersion]);

  // Shop display label
  const activeShopName = useMemo(() => {
    if (selectedShopId === "ALL") return "All Outlets (RightWay & Mega)";
    const found = allShops.find((s) => s.id === selectedShopId);
    return found ? found.name : activeShop.name;
  }, [selectedShopId, allShops, activeShop]);

  // Month name display
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthDisplay = `${monthNames[month - 1]} ${year}`;

  // Print Daily Report action
  const handlePrintDailyReport = (targetDailyData = dailyData) => {
    try {
      const html = renderDailySalesReportHTML(
        targetDailyData,
        activeShopName,
        currentUser?.displayName || "Staff"
      );
      openPrintModal(`Daily Sales Report — ${targetDailyData.dateKey}`, html);
    } catch (e: any) {
      showToast(e.message || "Failed to generate report", "error");
    }
  };

  // Print Batch Invoices action
  const handlePrintBatchInvoices = (targetDailyData = dailyData) => {
    try {
      if (targetDailyData.sales.length === 0) {
        showToast("No invoices to print for this day.", "error");
        return;
      }
      const html = renderDailyInvoicesBatchHTML(
        targetDailyData.sales,
        targetDailyData.itemsBySaleId,
        activeShop
      );
      openPrintModal(`Invoices Batch — ${targetDailyData.dateKey}`, html);
    } catch (e: any) {
      showToast(e.message || "Failed to generate invoices batch", "error");
    }
  };

  // Print Single Invoice
  const handlePrintSingleInvoice = (sale: any) => {
    try {
      const items = dailyData.itemsBySaleId[sale.id] || [];
      const html = renderSaleReceiptHTML(sale, items, activeShop, true);
      openPrintModal(`Invoice #${sale.invoiceNumber}`, html);
    } catch (e: any) {
      showToast(e.message || "Failed to print invoice", "error");
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "24px 32px", maxWidth: "1500px", margin: "0 auto" }}>
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
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
            {isSuperAdmin ? "Daily Sales & Reports" : "My Daily Sales"}
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0" }}>
            {isSuperAdmin
              ? "Audit daily sales, cashier shift reconciliation, and batch reprint invoices for any month."
              : `Sales and cashier drawer audit for ${currentUser?.displayName}.`}
          </p>
        </div>

        {/* Global Controls: Outlet picker, Month picker & Month Pack */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={16} style={{ color: "var(--ink-3)" }} />
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="select"
                style={{ height: "40px", fontSize: "14px", fontWeight: "600" }}
              >
                <option value="ALL">All Outlets (Combined)</option>
                {allShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month selector controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-control)",
              height: "40px",
              padding: "0 4px",
            }}
          >
            <button
              onClick={handlePrevMonth}
              title="Previous month"
              className="btn btn-ghost btn-sm"
              style={{ height: "32px", width: "32px", padding: 0 }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ padding: "0 12px", fontSize: "14px", fontWeight: "700", minWidth: "140px", textAlign: "center" }}>
              {monthDisplay}
            </div>
            <button
              onClick={handleNextMonth}
              title="Next month"
              className="btn btn-ghost btn-sm"
              style={{ height: "32px", width: "32px", padding: 0 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Super Admin Month Pack Button */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsMonthPackOpen(true)}
              className="btn btn-secondary"
              style={{ height: "40px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Layers size={16} />
              <span>Generate month pack</span>
            </button>
          )}
        </div>
      </div>

      {/* Month Calendar Strip / Grid */}
      <div
        className="card"
        style={{
          padding: "16px",
          marginBottom: "24px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={16} style={{ color: "var(--primary)" }} />
            <span>Select a Day in {monthDisplay}</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
            Asia/Colombo Timezone
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))",
            gap: "8px",
          }}
        >
          {monthSummaries.map((item) => {
            const isSelected = item.day === selectedDay;
            return (
              <button
                key={item.day}
                onClick={() => setSelectedDay(item.day)}
                style={{
                  background: isSelected
                    ? "var(--primary)"
                    : item.hasSales
                    ? "var(--surface)"
                    : "var(--surface-muted, #fafafa)",
                  color: isSelected ? "#fff" : "var(--ink)",
                  border: isSelected
                    ? "1px solid var(--primary)"
                    : item.hasSales
                    ? "1px solid var(--line-strong)"
                    : "1px solid var(--line)",
                  borderRadius: "var(--radius-control)",
                  padding: "8px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  opacity: !item.hasSales && !isSelected ? 0.75 : 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "68px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800" }}>{item.day}</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", opacity: isSelected ? 0.9 : 0.6 }}>
                    {item.dayOfWeek}
                  </span>
                </div>
                <div>
                  {item.hasSales ? (
                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          background: isSelected ? "rgba(255,255,255,0.25)" : "var(--primary-soft)",
                          color: isSelected ? "#fff" : "var(--primary-ink)",
                          display: "inline-block",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          marginBottom: "2px",
                        }}
                      >
                        {item.invoiceCount} {item.invoiceCount === 1 ? "inv" : "invs"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {formatCurrency(item.netSales)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: isSelected ? "#fff" : "var(--ink-4)" }}>
                      No sales
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Action Bar */}
      <div
        className="card"
        style={{
          padding: "20px 24px",
          marginBottom: "24px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--ink-3)", letterSpacing: "0.5px" }}>
            Daily Sales Overview
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)", marginTop: "2px" }}>
            {dailyData.dateDisplay} &nbsp;·&nbsp; <span style={{ color: "var(--primary)" }}>{activeShopName}</span>
          </div>
        </div>

        {/* Print Buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => handlePrintDailyReport()}
            className="btn btn-primary"
            style={{ height: "44px", display: "flex", alignItems: "center", gap: "8px", padding: "0 18px" }}
          >
            <Printer size={16} />
            <span>Print daily report</span>
          </button>

          <button
            onClick={() => handlePrintBatchInvoices()}
            className="btn btn-secondary"
            style={{ height: "44px", display: "flex", alignItems: "center", gap: "8px", padding: "0 18px" }}
            disabled={dailyData.sales.length === 0}
          >
            <Receipt size={16} />
            <span>Print invoices ({dailyData.sales.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>GROSS SALES</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--ink)", marginTop: "4px" }}>
            {formatCurrency(dailyData.grossSales)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
            Before discounts & returns
          </div>
        </div>

        <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>DISCOUNTS & RETURNS</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--danger)", marginTop: "4px" }}>
            -{formatCurrency(dailyData.itemDiscounts + dailyData.billDiscounts + dailyData.refunds)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
            Discounts: {formatCurrency(dailyData.itemDiscounts + dailyData.billDiscounts)} | Refunds: {formatCurrency(dailyData.refunds)}
          </div>
        </div>

        <div className="card" style={{ padding: "16px", border: "1px solid var(--line)", background: "var(--primary-soft)" }}>
          <div style={{ fontSize: "12px", color: "var(--primary-ink)", fontWeight: "700" }}>NET SALES</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--primary)", marginTop: "4px" }}>
            {formatCurrency(dailyData.netSales)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--primary-ink)", marginTop: "2px" }}>
            {dailyData.invoiceCount} {dailyData.invoiceCount === 1 ? "invoice" : "invoices"} completed
          </div>
        </div>

        <div className="card" style={{ padding: "16px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>REPAIR INCOME</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--success)", marginTop: "4px" }}>
            {formatCurrency(dailyData.repairIncome)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "2px" }}>
            Intake advances & deliveries
          </div>
        </div>
      </div>

      {/* Payment Tenders Breakdown */}
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
        <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "14px" }}>
          Payment Tender Breakdown
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface-muted, #f9fafb)", borderRadius: "var(--radius-control)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-2)", fontSize: "13px" }}>
              <Coins size={16} />
              <span>Cash</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
              {formatCurrency(dailyData.payments.cash)}
            </div>
          </div>

          <div style={{ padding: "12px 16px", background: "var(--surface-muted, #f9fafb)", borderRadius: "var(--radius-control)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-2)", fontSize: "13px" }}>
              <CreditCard size={16} />
              <span>Card (POS Terminal)</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
              {formatCurrency(dailyData.payments.card)}
            </div>
          </div>

          <div style={{ padding: "12px 16px", background: "var(--surface-muted, #f9fafb)", borderRadius: "var(--radius-control)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-2)", fontSize: "13px" }}>
              <Banknote size={16} />
              <span>Bank Transfer</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
              {formatCurrency(dailyData.payments.bankTransfer)}
            </div>
          </div>
        </div>
      </div>

      {/* Cashier Shifts Table */}
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
        <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "12px" }}>
          Cashier Shifts & Drawer Reconciliation
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--surface-muted, #f9fafb)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Cashier</th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Opening Float</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Cash Sales</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Cash Out</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Expected Cash</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Counted Cash</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.shifts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "16px", textAlign: "center", color: "var(--ink-3)" }}>
                    No shifts recorded for this day.
                  </td>
                </tr>
              ) : (
                dailyData.shifts.map((sh) => (
                  <tr key={sh.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "600" }}>{sh.cashierName}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: sh.status === "CLOSED" ? "var(--success-soft, #dcfce7)" : "var(--primary-soft)",
                          color: sh.status === "CLOSED" ? "var(--success)" : "var(--primary-ink)",
                        }}
                      >
                        {sh.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(sh.openingFloat)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(sh.cashSales)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(sh.cashDrops)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700" }}>{formatCurrency(sh.expectedCash)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {sh.closingCountedCash !== undefined ? formatCurrency(sh.closingCountedCash) : "Open"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontWeight: "700",
                        color: (sh.variance || 0) < 0 ? "var(--danger)" : "var(--success)",
                      }}
                    >
                      {sh.variance !== undefined ? formatCurrency(sh.variance) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices List Table */}
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
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)" }}>
            Invoices Issued on {dailyData.dateDisplay} ({dailyData.sales.length})
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--surface-muted, #f9fafb)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Invoice #</th>
                <th style={{ padding: "8px 12px" }}>Time</th>
                <th style={{ padding: "8px 12px" }}>Cashier</th>
                <th style={{ padding: "8px 12px" }}>Customer</th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Net Total</th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.sales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "var(--ink-3)" }}>
                    No invoices recorded on this day.
                  </td>
                </tr>
              ) : (
                dailyData.sales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>{sale.invoiceNumber}</td>
                    <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{formatDate(sale.createdAt)}</td>
                    <td style={{ padding: "10px 12px" }}>{sale.cashierNameCache || "Cashier"}</td>
                    <td style={{ padding: "10px 12px" }}>{sale.customerName || "Walk-in"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
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
                              : "var(--ink-3)",
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
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700" }}>
                      {formatCurrency(sale.total)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => handlePrintSingleInvoice(sale)}
                        className="btn btn-secondary btn-sm"
                        style={{ height: "30px", padding: "0 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Printer size={13} />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month Pack Modal (Super Admin) */}
      {isMonthPackOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--ink)" }}>
                  Monthly Reports Pack — {monthDisplay}
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                  Outlet: {activeShopName}
                </div>
              </div>
              <button
                onClick={() => setIsMonthPackOpen(false)}
                className="btn btn-ghost btn-sm"
                style={{ height: "32px", width: "32px", padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ padding: "12px", background: "var(--surface-muted, #f9fafb)", borderRadius: "var(--radius-control)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>TOTAL MONTH INVOICES</div>
                  <div style={{ fontSize: "20px", fontWeight: "900", color: "var(--ink)", marginTop: "2px" }}>
                    {monthSummaries.reduce((sum, s) => sum + s.invoiceCount, 0)}
                  </div>
                </div>
                <div style={{ padding: "12px", background: "var(--primary-soft)", borderRadius: "var(--radius-control)" }}>
                  <div style={{ fontSize: "12px", color: "var(--primary-ink)" }}>TOTAL MONTH NET SALES</div>
                  <div style={{ fontSize: "20px", fontWeight: "900", color: "var(--primary)", marginTop: "2px" }}>
                    {formatCurrency(monthSummaries.reduce((sum, s) => sum + s.netSales, 0))}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                Active Days in Month
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {monthSummaries.filter((s) => s.hasSales).length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                    No recorded sales in {monthDisplay}.
                  </div>
                ) : (
                  monthSummaries
                    .filter((s) => s.hasSales)
                    .map((item) => {
                      const dayTimestamp = new Date(
                        `${year}-${String(month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}T12:00:00+05:30`
                      ).getTime();
                      const targetDailyData = getDailySalesData(
                        selectedShopId,
                        dayTimestamp,
                        isSuperAdmin ? undefined : currentUser || undefined
                      );

                      return (
                        <div
                          key={item.day}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-control)",
                            background: "var(--surface)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "14px" }}>
                              {monthNames[month - 1]} {item.day}, {year} ({item.dayOfWeek})
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                              {item.invoiceCount} invoices &nbsp;·&nbsp; {formatCurrency(item.netSales)}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => handlePrintDailyReport(targetDailyData)}
                              className="btn btn-secondary btn-sm"
                              style={{ height: "32px", fontSize: "12px" }}
                            >
                              <Printer size={13} style={{ marginRight: "4px" }} />
                              Report
                            </button>
                            <button
                              onClick={() => handlePrintBatchInvoices(targetDailyData)}
                              className="btn btn-secondary btn-sm"
                              style={{ height: "32px", fontSize: "12px" }}
                            >
                              <Receipt size={13} style={{ marginRight: "4px" }} />
                              Invoices
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setIsMonthPackOpen(false)}
                className="btn btn-secondary"
                style={{ height: "40px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
