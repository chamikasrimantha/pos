// src/components/suppliers/SuppliersView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getSuppliers,
  getSupplierLedger,
  getCheques,
  createChequePayment,
  updateChequeStatus,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { ChequeStatus } from "@/types";
import {
  Building2,
  Receipt,
  CreditCard,
  Plus,
  CheckCircle2,
  X,
  ShieldAlert,
} from "lucide-react";

export function SuppliersView() {
  const { activeShop, currentUser, showToast, refreshData, dataVersion } = useApp();

  const [activeTab, setActiveTab] = useState<"PROFILES" | "LEDGER" | "CHEQUES">("PROFILES");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  // New Cheque Modal
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("Commercial Bank of Ceylon");
  const [chequeAmount, setChequeAmount] = useState("");
  const [chequeDueDays, setChequeDueDays] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suppliers = useMemo(() => getSuppliers(), [dataVersion]);
  const cheques = useMemo(() => getCheques(), [dataVersion]);

  // Set default selected supplier
  const activeSupplier = useMemo(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      return suppliers[0];
    }
    return suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];
  }, [suppliers, selectedSupplierId]);

  // Ledger for active supplier
  const ledgerData = useMemo(() => {
    if (!activeSupplier) return { transactions: [], outstandingBalance: 0 };
    return getSupplierLedger(activeSupplier.id);
  }, [activeSupplier, dataVersion]);

  // Handle Issue Cheque
  const handleIssueCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplier) return;
    const amt = parseFloat(chequeAmount) || 0;
    if (amt <= 0) {
      showToast("Amount must be greater than zero.", "error");
      return;
    }
    if (!chequeNumber.trim()) {
      showToast("Please enter a valid cheque number.", "error");
      return;
    }

    const days = parseInt(chequeDueDays) || 30;
    const dueTimestamp = Date.now() + days * 86400000;

    setIsSubmitting(true);
    try {
      const chq = await createChequePayment({
        supplierId: activeSupplier.id,
        shopId: activeShop.id,
        amount: amt,
        chequeNumber: chequeNumber.trim(),
        bankName: chequeBank.trim(),
        dueDate: dueTimestamp,
        notes: `PDC Cheque for ${days} days`,
        performedByRole: currentUser?.role || "",
      });

      showToast(`Cheque #${chq.chequeNumber} registered with pending status.`, "success");
      setIsChequeModalOpen(false);
      setChequeNumber("");
      setChequeAmount("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to issue cheque", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cheque Status Transition
  const handleChequeStatusChange = async (chequeId: string, newStatus: ChequeStatus) => {
    try {
      await updateChequeStatus({
        chequeId,
        newStatus,
        notes: `Status changed to ${newStatus}`,
        performedByRole: currentUser?.role || "",
      });
      showToast(`Cheque status updated to ${newStatus.toLowerCase()}.`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to update cheque status", "error");
    }
  };

  // Enforce Section 5.3: Super Admin only
  if (currentUser?.role !== "SUPER_ADMIN") {
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
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--danger-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <ShieldAlert size={28} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            Access Restricted
          </h3>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "8px", lineHeight: "1.5" }}>
            Supplier financial balances, accounts payable ledgers, and cheque lifecycle management are restricted exclusively to Super Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Suppliers & cheques
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Supplier profiles, account statements, and cheque lifecycle management.
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setIsChequeModalOpen(true)}>
          <Plus size={16} /> Issue supplier cheque
        </button>
      </div>

      {/* Tabs */}
      <div className="seg-control" style={{ width: "fit-content" }}>
        <button
          className={activeTab === "PROFILES" ? "active" : ""}
          onClick={() => setActiveTab("PROFILES")}
        >
          <Building2 size={15} /> Supplier profiles ({suppliers.length})
        </button>
        <button
          className={activeTab === "LEDGER" ? "active" : ""}
          onClick={() => setActiveTab("LEDGER")}
        >
          <Receipt size={15} /> Statements & ledger
        </button>
        <button
          className={activeTab === "CHEQUES" ? "active" : ""}
          onClick={() => setActiveTab("CHEQUES")}
        >
          <CreditCard size={15} /> Cheques ({cheques.length})
        </button>
      </div>

      {/* TAB 1: PROFILES */}
      {activeTab === "PROFILES" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
          {suppliers.map((s) => {
            const { outstandingBalance } = getSupplierLedger(s.id);
            return (
              <div
                key={s.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-tile)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>{s.name}</h3>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "8px" }}>
                    Contact: <strong style={{ color: "var(--ink)" }}>{s.contactPerson}</strong> • {s.phone}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    {s.address}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "4px" }}>
                    Terms: <strong style={{ color: "var(--ink)" }}>{s.paymentTerms}</strong> {s.taxNumber && `• ${s.taxNumber}`}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: "14px",
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                      Outstanding balance
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        fontVariantNumeric: "tabular-nums",
                        color: outstandingBalance > 0 ? "var(--ink)" : "var(--success)",
                        marginTop: "2px",
                      }}
                    >
                      {formatCurrency(outstandingBalance)}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedSupplierId(s.id);
                      setActiveTab("LEDGER");
                    }}
                  >
                    View statement
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: LEDGER */}
      {activeTab === "LEDGER" && activeSupplier && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--line)",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                Supplier statement
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", margin: "2px 0 0 0" }}>
                {activeSupplier.name}
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                {activeSupplier.contactPerson} • {activeSupplier.phone}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <select
                className="input-field"
                value={activeSupplier.id}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                style={{ width: "240px" }}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Current balance due</div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    fontVariantNumeric: "tabular-nums",
                    color: ledgerData.outstandingBalance > 0 ? "var(--ink)" : "var(--success)",
                  }}
                >
                  {formatCurrency(ledgerData.outstandingBalance)}
                </div>
              </div>
            </div>
          </div>

          {ledgerData.transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
              No transactions posted yet for {activeSupplier.name}. Inward a purchase bill to post credits.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Notes / Description</th>
                    <th className="num">Debit (Payment -)</th>
                    <th className="num">Credit (Purchase +)</th>
                    <th className="num">Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(tx.date)}
                      </td>
                      <td>
                        <span className={`badge ${tx.type === "PURCHASE" ? "badge-neutral" : "badge-success"}`}>
                          {tx.type === "PURCHASE" ? "Purchase" : "Payment"}
                        </span>
                      </td>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{tx.referenceNumber}</td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>{tx.notes}</td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {tx.debit > 0 ? formatCurrency(tx.debit) : "—"}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {tx.credit > 0 ? formatCurrency(tx.credit) : "—"}
                      </td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHEQUE REGISTER */}
      {activeTab === "CHEQUES" && (
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
              Cheque register & maturity tracking
            </h3>
          </div>

          {cheques.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
              No supplier cheques issued yet. Click &quot;Issue supplier cheque&quot; to log a payment cheque.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Cheque #</th>
                    <th>Supplier</th>
                    <th>Bank name</th>
                    <th className="num">Amount</th>
                    <th>Issue date</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cheques.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{c.chequeNumber}</td>
                      <td style={{ fontWeight: "500" }}>{c.supplierNameCache}</td>
                      <td style={{ color: "var(--ink-2)" }}>{c.bankName}</td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(c.amount)}
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(c.issueDate)}
                      </td>
                      <td style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", color: "var(--primary)" }}>
                        {formatDate(c.dueDate)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === "CLEARED"
                              ? "badge-success"
                              : c.status === "BOUNCED"
                              ? "badge-danger"
                              : "badge-amber"
                          }`}
                        >
                          {c.status === "CLEARED" ? "Cleared" : c.status === "BOUNCED" ? "Bounced" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {c.status === "PENDING" && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleChequeStatusChange(c.id, "CLEARED")}
                                title="Mark as cleared by bank"
                              >
                                Clear
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleChequeStatusChange(c.id, "BOUNCED")}
                                title="Mark bounced"
                              >
                                Bounced
                              </button>
                            </>
                          )}

                          {c.status === "CLEARED" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleChequeStatusChange(c.id, "BOUNCED")}
                              title="Post clearing bounce reversal"
                            >
                              Post reversal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ISSUE CHEQUE MODAL */}
      {isChequeModalOpen && activeSupplier && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleIssueCheque}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                  Issue supplier cheque
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Record a post-dated cheque for accounts payable
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Pay to supplier *
              </label>
              <select
                className="input-field"
                value={activeSupplier.id}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Cheque number *
              </label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. CHQ-998822"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Drawn bank name *
              </label>
              <input
                type="text"
                required
                className="input-field"
                value={chequeBank}
                onChange={(e) => setChequeBank(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="input-field"
                  placeholder="50000"
                  value={chequeAmount}
                  onChange={(e) => setChequeAmount(e.target.value)}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Due in (days)
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={chequeDueDays}
                  onChange={(e) => setChequeDueDays(e.target.value)}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsChequeModalOpen(false)}
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
                {isSubmitting ? "Registering…" : "Issue cheque"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
