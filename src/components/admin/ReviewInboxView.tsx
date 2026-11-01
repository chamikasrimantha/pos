// src/components/admin/ReviewInboxView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getReviewInboxCounts,
  getReviewInboxItems,
  markReviewInboxItem,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import {
  Inbox,
  ShieldAlert,
  CheckCircle2,
  Tag,
  Building2,
  Truck,
  CreditCard,
  Percent,
  ArrowLeftRight,
  Wrench,
  Users2,
  Clock,
  Filter,
  Search,
  MessageSquare,
  X,
  AlertTriangle,
} from "lucide-react";

type ReviewCategory =
  | "products"
  | "suppliers"
  | "purchases"
  | "cheques"
  | "priceOverrides"
  | "transfers"
  | "warranties"
  | "creditSales";

export function ReviewInboxView() {
  const { currentUser, dataVersion, refreshData, showToast, setActiveView } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<ReviewCategory>("products");
  const [minDiscountPercent, setMinDiscountPercent] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Review note modal state
  const [reviewingItem, setReviewingItem] = useState<{
    category: ReviewCategory;
    itemId: string;
    title: string;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live counts
  const counts = useMemo(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return {
        products: 0,
        suppliers: 0,
        purchases: 0,
        cheques: 0,
        priceOverrides: 0,
        transfers: 0,
        warranties: 0,
        creditSales: 0,
        total: 0,
      };
    }
    try {
      return getReviewInboxCounts(currentUser);
    } catch (e) {
      return {
        products: 0,
        suppliers: 0,
        purchases: 0,
        cheques: 0,
        priceOverrides: 0,
        transfers: 0,
        warranties: 0,
        creditSales: 0,
        total: 0,
      };
    }
  }, [currentUser, dataVersion]);

  // Review items for active tab
  const items = useMemo(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") return [];
    try {
      return getReviewInboxItems(currentUser, activeTab, {
        minDiscountPercent: activeTab === "priceOverrides" ? minDiscountPercent : undefined,
      });
    } catch (e) {
      return [];
    }
  }, [currentUser, activeTab, minDiscountPercent, dataVersion]);

  // Search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((it: any) => {
      return (
        it.name?.toLowerCase().includes(q) ||
        it.productName?.toLowerCase().includes(q) ||
        it.supplierName?.toLowerCase().includes(q) ||
        it.invoiceNumber?.toLowerCase().includes(q) ||
        it.purchaseNumber?.toLowerCase().includes(q) ||
        it.chequeNumber?.toLowerCase().includes(q) ||
        it.transferNumber?.toLowerCase().includes(q) ||
        it.repairNumber?.toLowerCase().includes(q) ||
        it.customerName?.toLowerCase().includes(q) ||
        it.cashierName?.toLowerCase().includes(q) ||
        it.createdBy?.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  // Handle Mark Reviewed
  const handleConfirmReview = async () => {
    if (!reviewingItem || !currentUser) return;
    setIsSubmitting(true);
    try {
      markReviewInboxItem({
        category: reviewingItem.category,
        itemId: reviewingItem.itemId,
        note: reviewNote,
        callingUser: currentUser,
      });
      showToast(`Marked ${reviewingItem.title} as reviewed`, "success");
      setReviewingItem(null);
      setReviewNote("");
      refreshData();
    } catch (e: any) {
      showToast(e.message || "Failed to mark item as reviewed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick mark without note
  const handleQuickMark = (category: ReviewCategory, itemId: string, title: string) => {
    if (!currentUser) return;
    try {
      markReviewInboxItem({
        category,
        itemId,
        note: "Reviewed and approved by Super Admin",
        callingUser: currentUser,
      });
      showToast(`Marked ${title} as reviewed`, "success");
      refreshData();
    } catch (e: any) {
      showToast(e.message || "Failed to mark item as reviewed", "error");
    }
  };

  // Guard: non-Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="page-responsive-container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: "480px",
            margin: "60px auto",
            padding: "36px 24px",
            background: "var(--surface)",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-tile)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "var(--danger-soft, #fef2f2)",
              color: "var(--danger)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--ink)", margin: "0 0 8px" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, margin: "0 0 20px" }}>
            The Review Inbox is strictly accessible by the Super Admin to audit cashier actions.
          </p>
          <button className="btn btn-secondary" onClick={() => setActiveView("pos")}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
              Review Inbox
            </h1>
            {counts.total > 0 && (
              <span
                style={{
                  background: "var(--danger)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                }}
              >
                {counts.total} pending
              </span>
            )}
          </div>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0" }}>
            Central audit queue for products, suppliers, purchases, cheques, price overrides, transfers, warranties, and credit sales.
          </p>
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: "240px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--ink-3)" }} />
          <input
            type="text"
            className="input"
            placeholder="Search items, invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px", height: "40px" }}
          />
        </div>
      </div>

      {/* Tabs with Live Badges */}
      <div
        className="seg-control"
        style={{
          width: "100%",
          overflowX: "auto",
          scrollbarWidth: "none",
          display: "flex",
          gap: "4px",
          padding: "4px",
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-control)",
        }}
      >
        <button
          className={activeTab === "products" ? "active" : ""}
          onClick={() => setActiveTab("products")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Tag size={15} />
          <span>New Products</span>
          {counts.products > 0 && <span className="badge badge-danger">{counts.products}</span>}
        </button>

        <button
          className={activeTab === "suppliers" ? "active" : ""}
          onClick={() => setActiveTab("suppliers")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Building2 size={15} />
          <span>New Suppliers</span>
          {counts.suppliers > 0 && <span className="badge badge-danger">{counts.suppliers}</span>}
        </button>

        <button
          className={activeTab === "purchases" ? "active" : ""}
          onClick={() => setActiveTab("purchases")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Truck size={15} />
          <span>Purchases</span>
          {counts.purchases > 0 && <span className="badge badge-danger">{counts.purchases}</span>}
        </button>

        <button
          className={activeTab === "cheques" ? "active" : ""}
          onClick={() => setActiveTab("cheques")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <CreditCard size={15} />
          <span>Cheques</span>
          {counts.cheques > 0 && <span className="badge badge-danger">{counts.cheques}</span>}
        </button>

        <button
          className={activeTab === "priceOverrides" ? "active" : ""}
          onClick={() => setActiveTab("priceOverrides")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Percent size={15} />
          <span>Price Overrides</span>
          {counts.priceOverrides > 0 && <span className="badge badge-danger">{counts.priceOverrides}</span>}
        </button>

        <button
          className={activeTab === "transfers" ? "active" : ""}
          onClick={() => setActiveTab("transfers")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeftRight size={15} />
          <span>Quick Transfers</span>
          {counts.transfers > 0 && <span className="badge badge-danger">{counts.transfers}</span>}
        </button>

        <button
          className={activeTab === "warranties" ? "active" : ""}
          onClick={() => setActiveTab("warranties")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Wrench size={15} />
          <span>Warranties</span>
          {counts.warranties > 0 && <span className="badge badge-danger">{counts.warranties}</span>}
        </button>

        <button
          className={activeTab === "creditSales" ? "active" : ""}
          onClick={() => setActiveTab("creditSales")}
          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Users2 size={15} />
          <span>Credit Sales</span>
          {counts.creditSales > 0 && <span className="badge badge-danger">{counts.creditSales}</span>}
        </button>
      </div>

      {/* Price Overrides Filter Sub-bar */}
      {activeTab === "priceOverrides" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
            padding: "12px 16px",
            borderRadius: "var(--radius-control)",
            border: "1px solid var(--line)",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={15} style={{ color: "var(--ink-3)" }} />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>
              Filter by Reduction Threshold:
            </span>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { label: "All reductions", val: 0 },
              { label: "≥ 10% off", val: 10 },
              { label: "≥ 20% off", val: 20 },
              { label: "≥ 30% off", val: 30 },
              { label: "≥ 50% off", val: 50 },
            ].map((btn) => (
              <button
                key={btn.val}
                className={`btn btn-sm ${minDiscountPercent === btn.val ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setMinDiscountPercent(btn.val)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review Items Display */}
      <div
        className="card"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        {filteredItems.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <CheckCircle2 size={40} style={{ color: "var(--success)", margin: "0 auto 12px" }} />
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)" }}>
              All clear in this category!
            </div>
            <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "4px" }}>
              There are no pending items requiring Super Admin review under {activeTab}.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--surface-sunken)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>What</th>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>Who</th>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>Branch</th>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>When</th>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>Details</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it: any) => {
                  let whatText = "";
                  let whoText = "";
                  let branchText = "";
                  let whenText = "";
                  let detailsElement: React.ReactNode = null;

                  if (activeTab === "products") {
                    whatText = it.name;
                    whoText = it.createdBy || "Cashier";
                    branchText = "All Outlets";
                    whenText = formatDate(it.createdAt);
                    detailsElement = (
                      <div>
                        <span className="badge badge-neutral" style={{ marginRight: "6px" }}>{it.productType}</span>
                        <span>{it.categoryName} &bull; {it.brandName}</span>
                      </div>
                    );
                  } else if (activeTab === "suppliers") {
                    whatText = it.name;
                    whoText = "Cashier";
                    branchText = "Central";
                    whenText = formatDate(it.createdAt);
                    detailsElement = (
                      <div>
                        <span>Phone: {it.phone}</span>
                        {it.contactPerson && it.contactPerson !== "N/A" && (
                          <span style={{ color: "var(--ink-3)", marginLeft: "8px" }}>Attn: {it.contactPerson}</span>
                        )}
                      </div>
                    );
                  } else if (activeTab === "purchases") {
                    whatText = `${it.purchaseNumber} (${it.supplierName})`;
                    whoText = it.receivedBy || "Cashier";
                    branchText = it.branchName;
                    whenText = formatDate(it.receivedAt);
                    detailsElement = (
                      <div>
                        <span style={{ fontWeight: "700" }}>{formatCurrency(it.totalAmount)}</span>
                        <span className="badge badge-neutral" style={{ marginLeft: "8px" }}>{it.paymentMethod}</span>
                        {it.costVarianceFlagged && (
                          <span className="badge badge-danger" style={{ marginLeft: "6px" }}>Cost variance</span>
                        )}
                      </div>
                    );
                  } else if (activeTab === "cheques") {
                    whatText = `Cheque #${it.chequeNumber}`;
                    whoText = it.issuedBy || "Cashier";
                    branchText = it.branchName;
                    whenText = formatDate(it.createdAt);
                    detailsElement = (
                      <div>
                        <span style={{ fontWeight: "700" }}>{formatCurrency(it.amount)}</span> &bull; {it.bankName}
                        <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>Payee: {it.supplierName} &bull; Due: {formatDate(it.dueDate)}</div>
                      </div>
                    );
                  } else if (activeTab === "priceOverrides") {
                    whatText = it.productName;
                    whoText = it.cashierName;
                    branchText = it.branchName;
                    whenText = formatDate(it.createdAt);
                    detailsElement = (
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ textDecoration: "line-through", color: "var(--ink-3)" }}>
                            {formatCurrency(it.listPrice)}
                          </span>
                          <span style={{ fontWeight: "700", color: "var(--ink)" }}>
                            {formatCurrency(it.priceCharged)}
                          </span>
                          <span className="badge badge-danger">
                            -{formatCurrency(it.reduction)} ({it.reductionPercent.toFixed(1)}% off)
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "2px" }}>
                          Inv #{it.invoiceNumber} &bull; Reason: {it.reason}
                        </div>
                      </div>
                    );
                  } else if (activeTab === "transfers") {
                    whatText = it.transferNumber;
                    whoText = it.dispatchedBy;
                    branchText = `${it.sourceBranch} → ${it.destinationBranch}`;
                    whenText = formatDate(it.dispatchedAt);
                    detailsElement = (
                      <div>
                        <span style={{ fontWeight: "700" }}>{it.totalQuantity} pairs</span>
                        <span className="badge badge-primary" style={{ marginLeft: "8px" }}>QUICK</span>
                      </div>
                    );
                  } else if (activeTab === "warranties") {
                    whatText = `${it.repairNumber} (${it.itemType})`;
                    whoText = it.receivedBy || "Cashier";
                    branchText = it.branchName;
                    whenText = formatDate(it.receivedAt);
                    detailsElement = (
                      <div>
                        <span style={{ fontWeight: "600" }}>{it.customerName} ({it.customerPhone})</span>
                        <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                          Article: {it.itemDescription} &bull; Card: {it.warrantyCardNumber}
                        </div>
                      </div>
                    );
                  } else if (activeTab === "creditSales") {
                    whatText = it.invoiceNumber;
                    whoText = it.cashierName;
                    branchText = it.branchName;
                    whenText = formatDate(it.createdAt);
                    detailsElement = (
                      <div>
                        <span>Bill: {formatCurrency(it.total)} &bull; Paid: {formatCurrency(it.amountPaid)}</span>
                        <div style={{ fontWeight: "700", color: "var(--danger)", fontSize: "12px" }}>
                          Balance due: {formatCurrency(it.balanceDue)} ({it.customerName})
                        </div>
                      </div>
                    );
                  }

                  return (
                    <tr key={it.id}>
                      <td style={{ padding: "10px 14px", fontWeight: "700" }}>{whatText}</td>
                      <td style={{ padding: "10px 14px" }}>{whoText}</td>
                      <td style={{ padding: "10px 14px", color: "var(--ink-2)" }}>{branchText}</td>
                      <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>{whenText}</td>
                      <td style={{ padding: "10px 14px" }}>{detailsElement}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Mark reviewed with note"
                            onClick={() =>
                              setReviewingItem({
                                category: activeTab,
                                itemId: it.id,
                                title: whatText,
                              })
                            }
                          >
                            <MessageSquare size={13} />
                            <span>Note</span>
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            title="Mark reviewed"
                            onClick={() => handleQuickMark(activeTab, it.id, whatText)}
                          >
                            <CheckCircle2 size={13} />
                            <span>Mark reviewed</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Note Dialog */}
      {reviewingItem && (
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
              maxWidth: "460px",
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                  Review & Approve
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  {reviewingItem.title}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setReviewingItem(null)}
                style={{ padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--ink)", marginBottom: "6px" }}>
                Audit Note (Optional):
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Verified supplier credentials / Approved special price override"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn btn-secondary" onClick={() => setReviewingItem(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmReview}
                disabled={isSubmitting}
              >
                <CheckCircle2 size={16} />
                <span>Confirm Reviewed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
