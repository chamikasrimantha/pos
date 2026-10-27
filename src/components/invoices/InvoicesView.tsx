// src/components/invoices/InvoicesView.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  getInvoicesForUser,
  logInvoiceReprint,
  InvoiceFilters,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate, renderSaleReceiptHTML } from "@/lib/receipt-generator";
import { getColomboDayRange, formatColomboDateTime } from "@/lib/date-utils";
import { Sale, SaleItem } from "@/types";
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  CreditCard,
  Banknote,
  Printer,
  RotateCcw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

export function InvoicesView({
  onStartReturnWithInvoice,
}: {
  onStartReturnWithInvoice?: (invNumber: string) => void;
}) {
  const {
    currentUser,
    shops,
    activeShop,
    users,
    openPrintModal,
    showToast,
    setActiveView,
    dataVersion,
  } = useApp();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState<"TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "ALL">("TODAY");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "PARTIALLY_RETURNED" | "FULLY_RETURNED" | "CANCELLED">("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "CASH" | "CARD" | "BANK_TRANSFER">("ALL");
  const [shopFilter, setShopFilter] = useState<string>("ALL");
  const [cashierFilter, setCashierFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Selected invoice for detail drawer
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // Compute timestamp ranges in Asia/Colombo based on preset
  const dateRange = useMemo(() => {
    const now = Date.now();
    const oneDay = 86400000;
    const { startOfDay, endOfDay } = getColomboDayRange(now);

    switch (dateRangePreset) {
      case "TODAY":
        return { startDate: startOfDay, endDate: endOfDay };
      case "YESTERDAY": {
        const yesterdayRange = getColomboDayRange(now - oneDay);
        return { startDate: yesterdayRange.startOfDay, endDate: yesterdayRange.endOfDay };
      }
      case "LAST_7":
        return { startDate: startOfDay - oneDay * 6, endDate: endOfDay };
      case "THIS_MONTH": {
        const d = new Date(now);
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        return { startDate: startOfMonth, endDate: endOfDay };
      }
      case "ALL":
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateRangePreset]);

  // Query invoices via secure data layer function
  const queryResult = useMemo(() => {
    if (!currentUser) {
      return { invoices: [], itemsBySaleId: {}, totalCount: 0, page: 1, pageSize: 50, totalPages: 1 };
    }

    const filters: InvoiceFilters = {
      search: searchQuery.trim() || undefined,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      status: statusFilter,
      paymentMethod: paymentFilter,
      shopId: isSuperAdmin && shopFilter !== "ALL" ? shopFilter : undefined,
      cashierId: isSuperAdmin && cashierFilter !== "ALL" ? cashierFilter : undefined,
    };

    return getInvoicesForUser(currentUser, filters, currentPage, 50);
  }, [
    currentUser,
    searchQuery,
    dateRange,
    statusFilter,
    paymentFilter,
    shopFilter,
    cashierFilter,
    currentPage,
    isSuperAdmin,
    dataVersion,
  ]);

  const { invoices, itemsBySaleId, totalCount, totalPages } = queryResult;

  // Handle Reprint
  const handleReprint = (sale: Sale) => {
    if (!currentUser) return;
    const items = itemsBySaleId[sale.id] || [];
    const shop = shops.find((s) => s.id === sale.shopId) || activeShop;

    // Log reprint marked duplicate
    logInvoiceReprint(currentUser, sale);

    // Generate duplicate HTML
    const html = renderSaleReceiptHTML(sale, items, shop, true);
    openPrintModal(`Invoice — ${sale.invoiceNumber} (DUPLICATE)`, html);
    showToast(`Reprinting invoice #${sale.invoiceNumber} (marked DUPLICATE)`, "info");
  };

  // Handle Start Return
  const handleStartReturn = (sale: Sale) => {
    if (onStartReturnWithInvoice) {
      onStartReturnWithInvoice(sale.invoiceNumber);
    } else {
      // Store in sessionStorage or state and navigate
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pos_return_invoice", sale.invoiceNumber);
      }
      setActiveView("returns");
    }
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
              {isSuperAdmin ? "All Sales Invoices" : "My Issued Invoices"}
            </h2>
            <span className="badge badge-primary" style={{ fontSize: "12px" }}>
              {totalCount} {totalCount === 1 ? "invoice" : "invoices"}
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "4px" }}>
            {isSuperAdmin
              ? "Centralized oversight across all cashiers and outlets with reprint & return tools."
              : `Sales receipts issued under your login (${currentUser?.displayName}).`}
          </div>
        </div>

        {/* Quick Search */}
        <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px", height: "40px", width: "320px", maxWidth: "100%" }}>
          <Search size={16} color="var(--ink-3)" style={{ marginRight: "8px", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search invoice#, customer, phone, total…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: "var(--ink)", width: "100%" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: "2px" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {/* Date Preset */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Calendar size={14} color="var(--ink-3)" />
          <select
            className="input-field"
            value={dateRangePreset}
            onChange={(e) => {
              setDateRangePreset(e.target.value as any);
              setCurrentPage(1);
            }}
            style={{ height: "36px", fontSize: "13px", padding: "4px 8px" }}
          >
            <option value="TODAY">Today (Asia/Colombo)</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7">Last 7 Days</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="ALL">All Time</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600" }}>Status:</span>
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            style={{ height: "36px", fontSize: "13px", padding: "4px 8px" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed (No Return)</option>
            <option value="PARTIALLY_RETURNED">Partially Returned</option>
            <option value="FULLY_RETURNED">Fully Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Payment Method */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <CreditCard size={14} color="var(--ink-3)" />
          <select
            className="input-field"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            style={{ height: "36px", fontSize: "13px", padding: "4px 8px" }}
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>

        {/* SUPER ADMIN FILTERS: Outlet & Issued-By */}
        {isSuperAdmin && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Store size={14} color="var(--ink-3)" />
              <select
                className="input-field"
                value={shopFilter}
                onChange={(e) => {
                  setShopFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: "36px", fontSize: "13px", padding: "4px 8px" }}
              >
                <option value="ALL">All Outlets</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} color="var(--ink-3)" />
              <select
                className="input-field"
                value={cashierFilter}
                onChange={(e) => {
                  setCashierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: "36px", fontSize: "13px", padding: "4px 8px" }}
              >
                <option value="ALL">All Staff</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Main Invoices Table (Desktop) / Cards (Phone) */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        {invoices.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
            <Receipt size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink-2)" }}>No invoices found</div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              Try broadening your date filter or search query.
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date & Time</th>
                    {isSuperAdmin && <th>Issued By</th>}
                    <th>Customer</th>
                    <th className="num">Total Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((sale) => {
                    const payMethod = sale.payments?.[0]?.method || "CASH";
                    const statusBadge =
                      sale.status === "CANCELLED"
                        ? "badge-danger"
                        : sale.returnStatus === "FULLY_RETURNED"
                        ? "badge-neutral"
                        : sale.returnStatus === "PARTIALLY_RETURNED"
                        ? "badge-warning"
                        : "badge-success";

                    const statusText =
                      sale.status === "CANCELLED"
                        ? "Cancelled"
                        : sale.returnStatus === "FULLY_RETURNED"
                        ? "Fully Returned"
                        : sale.returnStatus === "PARTIALLY_RETURNED"
                        ? "Partial Return"
                        : "Completed";

                    return (
                      <tr
                        key={sale.id}
                        style={{
                          cursor: "pointer",
                          background: selectedInvoice?.id === sale.id ? "var(--primary-soft)" : undefined,
                        }}
                        onClick={() => setSelectedInvoice(sale)}
                      >
                        <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {sale.invoiceNumber}
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                          {formatDate(sale.createdAt)}
                        </td>
                        {isSuperAdmin && (
                          <td style={{ fontSize: "13px", fontWeight: "500" }}>
                            {sale.cashierNameCache}
                          </td>
                        )}
                        <td>
                          {sale.customerName ? (
                            <div>
                              <div style={{ fontWeight: "600", fontSize: "13px" }}>{sale.customerName}</div>
                              {sale.customerPhone && (
                                <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>{sale.customerPhone}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "var(--ink-3)", fontSize: "13px" }}>Walk-in customer</span>
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(sale.total)}
                        </td>
                        <td>
                          <span style={{ fontSize: "12px", color: "var(--ink-2)", textTransform: "capitalize" }}>
                            {payMethod.toLowerCase().replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${statusBadge}`}>{statusText}</span>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="View Invoice Details"
                              onClick={() => setSelectedInvoice(sale)}
                              style={{ height: "32px", padding: "0 8px" }}
                            >
                              <Eye size={13} />
                              <span className="hide-mobile-sm">View</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Reprint Receipt (marked DUPLICATE)"
                              onClick={() => handleReprint(sale)}
                              style={{ height: "32px", padding: "0 8px" }}
                            >
                              <Printer size={13} />
                              <span className="hide-mobile-sm">Reprint</span>
                            </button>
                            {sale.status === "COMPLETED" && sale.returnStatus !== "FULLY_RETURNED" && (
                              <button
                                className="btn btn-secondary btn-sm"
                                title="Process return or exchange against this invoice"
                                onClick={() => handleStartReturn(sale)}
                                style={{ height: "32px", padding: "0 8px" }}
                              >
                                <RotateCcw size={13} />
                                <span className="hide-mobile-sm">Return</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  color: "var(--ink-2)",
                }}
              >
                <div>
                  Showing Page {currentPage} of {totalPages} ({totalCount} total)
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Detail Drawer Modal */}
      {selectedInvoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 24, 40, 0.4)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 9999,
          }}
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "500px",
              height: "100%",
              background: "var(--surface)",
              boxShadow: "var(--shadow-float)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)" }}>
                  {selectedInvoice.invoiceNumber}
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                  {formatDate(selectedInvoice.createdAt)} &bull; {selectedInvoice.shopId === "rightway" ? "RightWay Shoes" : "Mega Shoes"}
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
              {/* Status Banner */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background:
                    selectedInvoice.status === "CANCELLED"
                      ? "var(--danger-soft)"
                      : selectedInvoice.returnStatus === "FULLY_RETURNED"
                      ? "var(--surface-sunken)"
                      : selectedInvoice.returnStatus === "PARTIALLY_RETURNED"
                      ? "var(--warning-soft)"
                      : "var(--success-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                <span>Status:</span>
                <span>
                  {selectedInvoice.status === "CANCELLED"
                    ? "Cancelled"
                    : selectedInvoice.returnStatus === "FULLY_RETURNED"
                    ? "Fully Returned"
                    : selectedInvoice.returnStatus === "PARTIALLY_RETURNED"
                    ? `Partially Returned (${formatCurrency(selectedInvoice.returnedAmount)})`
                    : "Completed"}
                </span>
              </div>

              {/* Issuer & Shift Details */}
              <div style={{ background: "var(--canvas)", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><strong>Issued by:</strong> {selectedInvoice.cashierNameCache}</div>
                <div><strong>Shift ID:</strong> {selectedInvoice.shiftId}</div>
                {selectedInvoice.customerName && (
                  <div><strong>Customer:</strong> {selectedInvoice.customerName} ({selectedInvoice.customerPhone || "No Phone"})</div>
                )}
              </div>

              {/* Items List */}
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>
                  Purchased Footwear Lines
                </div>
                <div style={{ border: "1px solid var(--line)", borderRadius: "8px", overflow: "hidden" }}>
                  <table className="pos-table" style={{ fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: "center" }}>Qty</th>
                        <th className="num">Price</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itemsBySaleId[selectedInvoice.id] || []).map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div style={{ fontWeight: "600" }}>{it.variantDescriptionCache}</div>
                            {it.discount > 0 && (
                              <div style={{ fontSize: "11px", color: "var(--danger)" }}>
                                Disc: -{formatCurrency(it.discount)}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{it.quantity}</td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(it.unitSellingPrice)}</td>
                          <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-2)" }}>
                  <span>Subtotal:</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)" }}>
                    <span>Bill Discount:</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "16px", color: "var(--ink)", borderTop: "1px solid var(--line)", paddingTop: "6px", marginTop: "2px" }}>
                  <span>Net Total Paid:</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(selectedInvoice.total)}</span>
                </div>

                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--ink-3)" }}>
                  Payment breakdown: {selectedInvoice.payments?.map((p) => `${p.method} (${formatCurrency(p.amount)})`).join(", ")}
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--line)",
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                className="btn btn-primary"
                style={{ flex: 1, height: "46px" }}
                onClick={() => handleReprint(selectedInvoice)}
              >
                <Printer size={16} /> Reprint (Duplicate)
              </button>
              {selectedInvoice.status === "COMPLETED" && selectedInvoice.returnStatus !== "FULLY_RETURNED" && (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, height: "46px" }}
                  onClick={() => {
                    handleStartReturn(selectedInvoice);
                    setSelectedInvoice(null);
                  }}
                >
                  <RotateCcw size={16} /> Start Return
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
