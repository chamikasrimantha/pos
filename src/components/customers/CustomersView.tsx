// src/components/customers/CustomersView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getCustomers,
  getCustomerBalance,
  getCustomerLedger,
  getCustomerAgedBreakdown,
  getCustomerCreditInvoices,
  createCustomer,
  updateCustomer,
  receiveCustomerPayment,
  issueCashAdvance,
  adjustCustomerBalance,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderCustomerPaymentReceiptHTML,
  renderCashAdvanceVoucherHTML,
  renderCustomerStatementHTML,
} from "@/lib/receipt-generator";
import { Customer, CustomerType, CustomerLedgerEntry, Sale } from "@/types";
import { can } from "@/lib/permissions";
import {
  Users2,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  FileText,
  Printer,
  X,
  CreditCard,
  Banknote,
  Coins,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  TrendingUp,
  Receipt,
} from "lucide-react";

export function CustomersView() {
  const { currentUser, activeShop, showToast, openPrintModal, refreshData, dataVersion } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "REGULAR" | "STAFF" | "WITH_BALANCE">("ALL");

  // Selected customer for account details drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [accountTab, setAccountTab] = useState<"INVOICES" | "LEDGER">("INVOICES");

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isReceivePaymentOpen, setIsReceivePaymentOpen] = useState(false);
  const [isCashAdvanceOpen, setIsCashAdvanceOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);

  // New Customer Form State
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custType, setCustType] = useState<CustomerType>("REGULAR");
  const [custEmployeeId, setCustEmployeeId] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custCreditLimit, setCustCreditLimit] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Form State
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");

  // Cash Advance Form State
  const [advAmount, setAdvAmount] = useState("");
  const [advNote, setAdvNote] = useState("");

  // Adjustment Form State
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDirection, setAdjDirection] = useState<"DEBIT" | "CREDIT">("CREDIT");
  const [adjReason, setAdjReason] = useState("");
  const [isWriteOff, setIsWriteOff] = useState(false);

  // Load customers
  const customers = useMemo(() => getCustomers(), [dataVersion]);

  // Derived balance map: customerId -> balance
  const customerBalanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach((c) => {
      map[c.id] = getCustomerBalance(c.id);
    });
    return map;
  }, [customers, dataVersion]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const bal = customerBalanceMap[c.id] || 0;
      if (filterType === "REGULAR") return c.type === "REGULAR";
      if (filterType === "STAFF") return c.type === "STAFF";
      if (filterType === "WITH_BALANCE") return bal > 0;
      return true;
    });
  }, [customers, searchQuery, filterType, customerBalanceMap]);

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const selectedBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    return customerBalanceMap[selectedCustomer.id] || 0;
  }, [selectedCustomer, customerBalanceMap]);

  const selectedAged = useMemo(() => {
    if (!selectedCustomer) return { d30: 0, d60: 0, d90: 0, d90Plus: 0, total: 0 };
    return getCustomerAgedBreakdown(selectedCustomer.id);
  }, [selectedCustomer, dataVersion]);

  const selectedInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return getCustomerCreditInvoices(selectedCustomer.id);
  }, [selectedCustomer, dataVersion]);

  const selectedLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    return getCustomerLedger(selectedCustomer.id);
  }, [selectedCustomer, dataVersion]);

  // Metrics
  const metrics = useMemo(() => {
    let totalBal = 0;
    let staffBal = 0;
    let overLimitCount = 0;

    customers.forEach((c) => {
      const b = customerBalanceMap[c.id] || 0;
      if (b > 0) {
        totalBal += b;
        if (c.type === "STAFF") staffBal += b;
        if (c.creditLimit && c.creditLimit > 0 && b > c.creditLimit) {
          overLimitCount++;
        }
      }
    });

    return {
      totalCustomers: customers.length,
      totalCreditOutstanding: totalBal,
      staffCreditOutstanding: staffBal,
      overLimitCount,
    };
  }, [customers, customerBalanceMap]);

  // Role permissions
  const canReceivePayment = currentUser ? can(currentUser, "customers.payment.receive") : false;
  const canCashAdvance = currentUser ? can(currentUser, "customers.cash_advance") : false;
  const canManageCustomer = currentUser ? can(currentUser, "customers.manage") : false;

  // Handle Add Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!custName.trim() || !custPhone.trim()) {
      showToast("Name and phone number are required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const limitNum = custCreditLimit ? parseFloat(custCreditLimit) : undefined;
      const created = await createCustomer({
        name: custName.trim(),
        phone: custPhone.trim(),
        type: custType,
        employeeId: custType === "STAFF" ? custEmployeeId.trim() : undefined,
        address: custAddress.trim() || undefined,
        creditLimit: limitNum,
        notes: custNotes.trim() || undefined,
        createdBy: currentUser.uid,
      });

      showToast(`Customer "${created.name}" created successfully.`, "success");
      setIsAddCustomerOpen(false);
      resetCustomerForm();
      refreshData();
      setSelectedCustomerId(created.id);
    } catch (err: any) {
      showToast(err.message || "Failed to create customer.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCustomerForm = () => {
    setCustName("");
    setCustPhone("");
    setCustType("REGULAR");
    setCustEmployeeId("");
    setCustAddress("");
    setCustCreditLimit("");
    setCustNotes("");
  };

  // Handle Receive Payment
  const handleReceivePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !currentUser) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid payment amount.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const receipt = await receiveCustomerPayment({
        customerId: selectedCustomer.id,
        shopId: activeShop.id === "all" ? "rightway" : activeShop.id,
        amount,
        method: payMethod,
        reference: payReference.trim() || undefined,
        note: payNote.trim() || undefined,
        receivedBy: currentUser.uid,
        receivedByName: currentUser.displayName,
      });

      showToast(`Payment of ${formatCurrency(amount)} received!`, "success");
      setIsReceivePaymentOpen(false);
      setPayAmount("");
      setPayReference("");
      setPayNote("");
      refreshData();

      // Print Payment Receipt
      const receiptHTML = renderCustomerPaymentReceiptHTML(
        receipt,
        activeShop,
        Math.max(0, selectedBalance - amount)
      );
      openPrintModal(`Payment Receipt — ${receipt.paymentNumber}`, receiptHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to process payment.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cash Advance Submit (Super Admin Only)
  const handleCashAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !currentUser) return;
    const amount = parseFloat(advAmount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid advance amount.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const voucher = await issueCashAdvance({
        customerId: selectedCustomer.id,
        shopId: activeShop.id === "all" ? "rightway" : activeShop.id,
        amount,
        date: Date.now(),
        note: advNote.trim() || undefined,
        issuedBy: currentUser.uid,
        issuedByName: currentUser.displayName,
      });

      showToast(`Cash advance of ${formatCurrency(amount)} issued.`, "success");
      setIsCashAdvanceOpen(false);
      setAdvAmount("");
      setAdvNote("");
      refreshData();

      // Print Cash Advance Voucher
      const voucherHTML = renderCashAdvanceVoucherHTML(voucher, activeShop);
      openPrintModal(`Advance Voucher — ${voucher.voucherNumber}`, voucherHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to issue advance.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Balance Adjustment Submit (Super Admin Only)
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !currentUser) return;
    const amount = parseFloat(adjAmount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid adjustment amount.", "error");
      return;
    }
    if (!adjReason.trim()) {
      showToast("A reason is required for adjustments.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await adjustCustomerBalance({
        customerId: selectedCustomer.id,
        shopId: activeShop.id === "all" ? "rightway" : activeShop.id,
        amount,
        direction: isWriteOff ? "CREDIT" : adjDirection,
        reason: adjReason.trim(),
        userId: currentUser.uid,
        isWriteOff,
      });

      showToast(`Customer balance ${isWriteOff ? "written off" : "adjusted"} successfully.`, "success");
      setIsAdjustBalanceOpen(false);
      setAdjAmount("");
      setAdjReason("");
      setIsWriteOff(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to adjust balance.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Print Customer Statement
  const handlePrintStatement = () => {
    if (!selectedCustomer) return;
    const html = renderCustomerStatementHTML(
      selectedCustomer,
      selectedLedger,
      selectedAged,
      activeShop
    );
    openPrintModal(`Statement — ${selectedCustomer.name}`, html);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
      {/* Header & Metrics */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Users2 size={26} color="var(--primary)" />
            Customers & Credit
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0" }}>
            Track customer credit, accept settlements on account, and manage staff cash advances.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            resetCustomerForm();
            setIsAddCustomerOpen(true);
          }}
          style={{ height: "44px", padding: "0 18px", gap: "8px" }}
        >
          <Plus size={16} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            padding: "16px 20px",
            borderRadius: "var(--radius-panel)",
            border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink-3)", textTransform: "uppercase" }}>
            Total Customers
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {metrics.totalCustomers}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>Active customer profiles</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: "16px 20px",
            borderRadius: "var(--radius-panel)",
            border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--danger)", textTransform: "uppercase" }}>
            Total Outstanding Credit
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--danger)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(metrics.totalCreditOutstanding)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>Company-wide debt receivable</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: "16px 20px",
            borderRadius: "var(--radius-panel)",
            border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#4f46e5", textTransform: "uppercase" }}>
            Staff Credit Balance
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#4f46e5", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(metrics.staffCreditOutstanding)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>Recoverable via payroll</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: "16px 20px",
            borderRadius: "var(--radius-panel)",
            border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: "600", color: metrics.overLimitCount > 0 ? "var(--warning)" : "var(--ink-3)", textTransform: "uppercase" }}>
            Over Credit Limit
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: metrics.overLimitCount > 0 ? "var(--warning)" : "var(--ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
            {metrics.overLimitCount}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>Exceeding assigned cap</div>
        </div>
      </div>

      {/* Main Search & Filter Toolbar */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-panel)",
          padding: "16px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, minWidth: "260px" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--canvas)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-control)",
              padding: "0 12px",
              height: "44px",
            }}
          >
            <Search size={18} style={{ color: "var(--ink-3)" }} />
            <input
              type="text"
              placeholder="Search by customer name, phone, address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "100%",
                fontSize: "14px",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { id: "ALL", label: "All Customers" },
            { id: "REGULAR", label: "Regular" },
            { id: "STAFF", label: "Staff" },
            { id: "WITH_BALANCE", label: "With Balance" },
          ].map((tab) => {
            const isSel = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: isSel ? 700 : 500,
                  background: isSel ? "var(--primary)" : "var(--sunken)",
                  color: isSel ? "#fff" : "var(--ink-2)",
                  border: isSel ? "1px solid var(--primary)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer List (Responsive Cards / Table) */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-panel)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--line)", color: "var(--ink-2)", fontSize: "12px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Customer Name</th>
                <th style={{ padding: "12px 16px" }}>Phone</th>
                <th style={{ padding: "12px 16px" }}>Type</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Outstanding Balance</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Limit</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "var(--ink-3)" }}>
                    No customers found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const bal = customerBalanceMap[cust.id] || 0;
                  const isOver = cust.creditLimit && cust.creditLimit > 0 && bal > cust.creditLimit;

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        background: selectedCustomerId === cust.id ? "var(--primary-soft)" : "transparent",
                        transition: "background 0.12s",
                      }}
                      className="hover-highlight"
                    >
                      <td style={{ padding: "14px 16px", fontWeight: "600", color: "var(--ink)" }}>
                        <div>{cust.name}</div>
                        {cust.address && <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "normal" }}>{cust.address}</div>}
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {cust.phone}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: cust.type === "STAFF" ? "#e0e7ff" : "var(--sunken)",
                            color: cust.type === "STAFF" ? "#3730a3" : "var(--ink-2)",
                          }}
                        >
                          {cust.type}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ color: bal > 0 ? "var(--danger)" : "var(--success)" }}>
                          {formatCurrency(bal)}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {cust.creditLimit ? (
                          <span style={{ color: isOver ? "var(--danger)" : "inherit", fontWeight: isOver ? 700 : "normal" }}>
                            {formatCurrency(cust.creditLimit)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }}>No limit</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: cust.active ? "#dcfce7" : "#fee2e2",
                            color: cust.active ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {cust.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId(cust.id);
                          }}
                          style={{ height: "32px", fontSize: "12px", gap: "4px" }}
                        >
                          <span>Account</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Account Drawer / Modal */}
      {selectedCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              height: "100%",
              background: "var(--surface)",
              boxShadow: "var(--shadow-floating)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "var(--canvas)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                    {selectedCustomer.name}
                  </h2>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: selectedCustomer.type === "STAFF" ? "#e0e7ff" : "var(--sunken)",
                      color: selectedCustomer.type === "STAFF" ? "#3730a3" : "var(--ink-2)",
                    }}
                  >
                    {selectedCustomer.type}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "4px", display: "flex", gap: "16px" }}>
                  <span>📞 {selectedCustomer.phone}</span>
                  {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedCustomerId(null)}
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Account Quick Summary & Action Bar */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "var(--canvas)", padding: "12px 16px", borderRadius: "var(--radius-panel)", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Current Balance</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: selectedBalance > 0 ? "var(--danger)" : "var(--success)", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
                    {formatCurrency(selectedBalance)}
                  </div>
                </div>
                <div style={{ background: "var(--canvas)", padding: "12px 16px", borderRadius: "var(--radius-panel)", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "600", textTransform: "uppercase" }}>Credit Limit</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
                    {selectedCustomer.creditLimit ? formatCurrency(selectedCustomer.creditLimit) : "None"}
                  </div>
                </div>
              </div>

              {/* Aged Debt Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center", background: "var(--sunken)", padding: "8px", borderRadius: "var(--radius-control)", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--ink-3)", fontWeight: "600" }}>0–30 D</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>{formatCurrency(selectedAged.d30)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--ink-3)", fontWeight: "600" }}>31–60 D</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>{formatCurrency(selectedAged.d60)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--ink-3)", fontWeight: "600" }}>61–90 D</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>{formatCurrency(selectedAged.d90)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--danger)", fontWeight: "600" }}>&gt; 90 D</div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--danger)" }}>{formatCurrency(selectedAged.d90Plus)}</div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {canReceivePayment && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setPayAmount(selectedBalance > 0 ? selectedBalance.toString() : "");
                      setIsReceivePaymentOpen(true);
                    }}
                    style={{ height: "38px", gap: "6px" }}
                  >
                    <ArrowDownLeft size={15} />
                    <span>Receive Payment</span>
                  </button>
                )}

                {canCashAdvance && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAdvAmount("");
                      setIsCashAdvanceOpen(true);
                    }}
                    style={{ height: "38px", gap: "6px" }}
                  >
                    <ArrowUpRight size={15} />
                    <span>Cash Advance</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrintStatement}
                  style={{ height: "38px", gap: "6px" }}
                >
                  <Printer size={15} />
                  <span>Print Statement</span>
                </button>

                {canManageCustomer && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAdjAmount("");
                      setIsAdjustBalanceOpen(true);
                    }}
                    style={{ height: "38px", gap: "6px" }}
                  >
                    <FileText size={15} />
                    <span>Adjust / Write Off</span>
                  </button>
                )}
              </div>
            </div>

            {/* Account Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--canvas)", padding: "0 24px" }}>
              <button
                type="button"
                onClick={() => setAccountTab("INVOICES")}
                style={{
                  padding: "12px 16px",
                  fontSize: "13px",
                  fontWeight: accountTab === "INVOICES" ? 700 : 500,
                  color: accountTab === "INVOICES" ? "var(--primary)" : "var(--ink-2)",
                  borderBottom: accountTab === "INVOICES" ? "2px solid var(--primary)" : "2px solid transparent",
                  background: "transparent",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Outstanding Credit Invoices ({selectedInvoices.length})
              </button>

              <button
                type="button"
                onClick={() => setAccountTab("LEDGER")}
                style={{
                  padding: "12px 16px",
                  fontSize: "13px",
                  fontWeight: accountTab === "LEDGER" ? 700 : 500,
                  color: accountTab === "LEDGER" ? "var(--primary)" : "var(--ink-2)",
                  borderBottom: accountTab === "LEDGER" ? "2px solid var(--primary)" : "2px solid transparent",
                  background: "transparent",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Transaction Ledger ({selectedLedger.length})
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {accountTab === "INVOICES" && (
                <div>
                  {selectedInvoices.length === 0 ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)" }}>
                      No unpaid credit invoices.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {selectedInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          style={{
                            background: "var(--canvas)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-panel)",
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)" }}>
                              Invoice #{inv.invoiceNumber}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "2px" }}>
                              {formatDate(inv.createdAt)} • {inv.cashierNameCache}
                            </div>
                            <div style={{ fontSize: "12px", marginTop: "4px" }}>
                              Total: {formatCurrency(inv.total)} • Paid: {formatCurrency(inv.amountPaid || 0)}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase" }}>Balance Due</div>
                            <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(inv.balanceDue)}
                            </div>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: inv.paymentStatus === "PARTIALLY_PAID" ? "#fef3c7" : "#fee2e2",
                                color: inv.paymentStatus === "PARTIALLY_PAID" ? "#92400e" : "#b91c1c",
                              }}
                            >
                              {inv.paymentStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {accountTab === "LEDGER" && (
                <div>
                  {selectedLedger.length === 0 ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)" }}>
                      No ledger history found.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {selectedLedger.map((entry) => {
                        const isDebit = entry.direction === "DEBIT";
                        return (
                          <div
                            key={entry.id}
                            style={{
                              background: "var(--canvas)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--radius-control)",
                              padding: "10px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{entry.type.replace(/_/g, " ")}</span>
                                {entry.referenceNumber && (
                                  <span style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: "normal" }}>
                                    ({entry.referenceNumber})
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "2px" }}>
                                {formatDate(entry.createdAt)} {entry.method && `• Method: ${entry.method}`}
                              </div>
                              {entry.note && (
                                <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "4px" }}>
                                  {entry.note}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: "15px",
                                  fontWeight: "800",
                                  color: isDebit ? "var(--danger)" : "var(--success)",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {isDebit ? `+${formatCurrency(entry.amount)}` : `-${formatCurrency(entry.amount)}`}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--ink-3)", textTransform: "uppercase" }}>
                                {entry.direction}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "24px",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Add New Customer
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddCustomerOpen(false)}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Sunil Perera"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="e.g. 0771234567"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Customer Type
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setCustType("REGULAR")}
                    style={{
                      flex: 1,
                      height: "40px",
                      borderRadius: "var(--radius-control)",
                      border: custType === "REGULAR" ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: custType === "REGULAR" ? "var(--primary-soft)" : "var(--surface)",
                      color: custType === "REGULAR" ? "var(--primary-ink)" : "var(--ink-2)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Regular Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustType("STAFF")}
                    style={{
                      flex: 1,
                      height: "40px",
                      borderRadius: "var(--radius-control)",
                      border: custType === "STAFF" ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: custType === "STAFF" ? "var(--primary-soft)" : "var(--surface)",
                      color: custType === "STAFF" ? "#3730a3" : "var(--ink-2)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Staff Member
                  </button>
                </div>
              </div>

              {custType === "STAFF" && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                    Linked Employee ID (Optional)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. emp_kamal"
                    value={custEmployeeId}
                    onChange={(e) => setCustEmployeeId(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Credit Limit (Rs., Optional)
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 50000 (leave blank for no preset limit)"
                  value={custCreditLimit}
                  onChange={(e) => setCustCreditLimit(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Postal / Delivery Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. No. 45 Main Street, Colombo"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Notes
                </label>
                <textarea
                  className="input-field"
                  placeholder="Optional customer notes…"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={2}
                  style={{ resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddCustomerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !custName.trim() || !custPhone.trim()}
                >
                  {isSubmitting ? "Creating…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {isReceivePaymentOpen && selectedCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Receive Payment on Account
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsReceivePaymentOpen(false)}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "var(--canvas)", padding: "12px", borderRadius: "var(--radius-control)", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Customer:</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)" }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: "13px", color: "var(--danger)", fontWeight: "700", marginTop: "4px" }}>
                Outstanding: {formatCurrency(selectedBalance)}
              </div>
            </div>

            <form onSubmit={handleReceivePaymentSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={{ fontSize: "18px", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Payment Method *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setPayMethod("CASH")}
                    style={{
                      height: "40px",
                      borderRadius: "var(--radius-control)",
                      border: payMethod === "CASH" ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: payMethod === "CASH" ? "var(--primary-soft)" : "var(--surface)",
                      color: payMethod === "CASH" ? "var(--primary-ink)" : "var(--ink-2)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <Banknote size={15} /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod("CARD")}
                    style={{
                      height: "40px",
                      borderRadius: "var(--radius-control)",
                      border: payMethod === "CARD" ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: payMethod === "CARD" ? "var(--primary-soft)" : "var(--surface)",
                      color: payMethod === "CARD" ? "var(--primary-ink)" : "var(--ink-2)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <CreditCard size={15} /> Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod("BANK_TRANSFER")}
                    style={{
                      height: "40px",
                      borderRadius: "var(--radius-control)",
                      border: payMethod === "BANK_TRANSFER" ? "2px solid var(--primary)" : "1px solid var(--line)",
                      background: payMethod === "BANK_TRANSFER" ? "var(--primary-soft)" : "var(--surface)",
                      color: payMethod === "BANK_TRANSFER" ? "var(--primary-ink)" : "var(--ink-2)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <Coins size={15} /> Bank
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Reference # (Slip / Cheque / Txn)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. TXN-998822"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Note (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Part payment on account"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>

              <div style={{ fontSize: "12px", color: "var(--ink-3)", background: "var(--sunken)", padding: "8px 10px", borderRadius: "6px" }}>
                ℹ️ Payment will automatically settle the <strong>oldest unpaid credit invoices first (FIFO)</strong>.
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReceivePaymentOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !parseFloat(payAmount)}
                >
                  {isSubmitting ? "Processing…" : "Receive & Print Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Advance Modal (Super Admin Only) */}
      {isCashAdvanceOpen && selectedCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Issue Cash Advance
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsCashAdvanceOpen(false)}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "var(--canvas)", padding: "12px", borderRadius: "var(--radius-control)", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Recipient:</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)" }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                Type: {selectedCustomer.type} {selectedCustomer.type === "STAFF" && "• Recoverable in monthly payroll"}
              </div>
            </div>

            <form onSubmit={handleCashAdvanceSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Advance Amount (Rs.) *
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0.00"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  style={{ fontSize: "18px", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Mid-month emergency expense advance"
                  value={advNote}
                  onChange={(e) => setAdvNote(e.target.value)}
                />
              </div>

              <div style={{ fontSize: "12px", color: "#991b1b", background: "#fef2f2", padding: "8px 10px", borderRadius: "6px" }}>
                ⚠️ This will record a cash payout from drawer/safe and increase customer debt.
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCashAdvanceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !parseFloat(advAmount)}
                >
                  {isSubmitting ? "Issuing…" : "Issue Advance & Print"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust / Write-off Modal (Super Admin Only) */}
      {isAdjustBalanceOpen && selectedCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Adjust Customer Balance
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAdjustBalanceOpen(false)}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "var(--ink)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isWriteOff}
                    onChange={(e) => {
                      setIsWriteOff(e.target.checked);
                      if (e.target.checked) {
                        setAdjDirection("CREDIT");
                        setAdjAmount(selectedBalance.toString());
                      }
                    }}
                  />
                  <span>Bad Debt Write-off (Clears balance as expense)</span>
                </label>
              </div>

              {!isWriteOff && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                    Direction
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setAdjDirection("CREDIT")}
                      style={{
                        flex: 1,
                        height: "38px",
                        borderRadius: "var(--radius-control)",
                        border: adjDirection === "CREDIT" ? "2px solid var(--primary)" : "1px solid var(--line)",
                        background: adjDirection === "CREDIT" ? "var(--primary-soft)" : "var(--surface)",
                        color: adjDirection === "CREDIT" ? "var(--primary-ink)" : "var(--ink-2)",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Credit (Reduce Debt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjDirection("DEBIT")}
                      style={{
                        flex: 1,
                        height: "38px",
                        borderRadius: "var(--radius-control)",
                        border: adjDirection === "DEBIT" ? "2px solid var(--primary)" : "1px solid var(--line)",
                        background: adjDirection === "DEBIT" ? "var(--primary-soft)" : "var(--surface)",
                        color: adjDirection === "DEBIT" ? "var(--primary-ink)" : "var(--ink-2)",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Debit (Increase Debt)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Adjustment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  style={{ fontSize: "16px", fontWeight: "700" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Reason *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Disputed charge waiver / rounding correction"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAdjustBalanceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !parseFloat(adjAmount) || !adjReason.trim()}
                >
                  {isSubmitting ? "Adjusting…" : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

