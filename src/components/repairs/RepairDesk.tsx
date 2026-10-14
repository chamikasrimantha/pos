// src/components/repairs/RepairDesk.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getRepairOrders,
  createRepairOrder,
  updateRepairStatus,
  deliverRepairOrder,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderRepairIntakeSlipHTML,
  renderRepairDeliveryReceiptHTML,
} from "@/lib/receipt-generator";
import { ShoeRepairOrder, RepairStatus, PaymentMethod } from "@/types";
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Calendar,
  X,
  CreditCard,
  Banknote,
  Truck,
  Sparkles,
} from "lucide-react";

export function RepairDesk() {
  const {
    activeShop,
    currentUser,
    activeShift,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [searchPhoneQuery, setSearchPhoneQuery] = useState("");

  // Intake Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [shoeBrand, setShoeBrand] = useState("Clarks");
  const [shoeModel, setShoeModel] = useState("Leather Loafer");
  const [shoeSize, setShoeSize] = useState("42");
  const [shoeColor, setShoeColor] = useState("Brown");
  const [isStorePurchased, setIsStorePurchased] = useState(false);
  const [issueDescription, setIssueDescription] = useState("Sole detached at front toe; replace worn heel tips and polish.");
  const [estimatedCost, setEstimatedCost] = useState("2500");
  const [advancePaid, setAdvancePaid] = useState("1000");
  const [advanceMethod, setAdvanceMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [promisedDays, setPromisedDays] = useState("4");
  const [intakeNotes, setIntakeNotes] = useState("");

  // Delivery Modal State
  const [selectedRepairForDelivery, setSelectedRepairForDelivery] = useState<ShoeRepairOrder | null>(null);
  const [finalDeliveryCost, setFinalDeliveryCost] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load repairs
  const repairs = useMemo(() => {
    return getRepairOrders(activeShop.id);
  }, [activeShop.id, dataVersion]);

  // Filtered repairs
  const filteredRepairs = useMemo(() => {
    const q = searchPhoneQuery.toLowerCase().trim();
    if (!q) return repairs;
    return repairs.filter(
      (r) =>
        r.customerPhone.includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.repairNumber.toLowerCase().includes(q) ||
        r.shoeBrand.toLowerCase().includes(q)
    );
  }, [repairs, searchPhoneQuery]);

  // Status breakdown
  const statusCounts = useMemo(() => {
    return {
      RECEIVED: repairs.filter((r) => r.status === "RECEIVED").length,
      UNDER_REPAIR: repairs.filter((r) => r.status === "UNDER_REPAIR").length,
      READY_FOR_PICKUP: repairs.filter((r) => r.status === "READY_FOR_PICKUP").length,
      DELIVERED: repairs.filter((r) => r.status === "DELIVERED").length,
    };
  }, [repairs]);

  // Submit Intake
  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !currentUser) {
      showToast("Cannot accept repair: Active cashier shift is required.", "error");
      return;
    }

    const est = parseFloat(estimatedCost) || 0;
    const adv = parseFloat(advancePaid) || 0;
    const days = parseInt(promisedDays) || 3;
    const promisedTimestamp = Date.now() + days * 86400000;

    setIsSubmitting(true);
    try {
      const order = await createRepairOrder({
        shopId: activeShop.id,
        intakeCashierId: currentUser.uid,
        intakeShiftId: activeShift.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim() || undefined,
        shoeBrand: shoeBrand.trim(),
        shoeModel: shoeModel.trim(),
        shoeSize: shoeSize.trim(),
        shoeColor: shoeColor.trim(),
        isStorePurchased,
        issueDescription: issueDescription.trim(),
        estimatedCost: est,
        advancePaid: adv,
        advancePaymentMethod: adv > 0 ? advanceMethod : undefined,
        promisedDate: promisedTimestamp,
        notes: intakeNotes.trim() || undefined,
      });

      showToast(`Repair job #${order.repairNumber} logged!`, "success");
      setIsIntakeModalOpen(false);
      refreshData();

      // Automatically pop Customer Intake Claim Slip & Shoe Attachment Tag
      const slipHTML = renderRepairIntakeSlipHTML(order, activeShop);
      openPrintModal(`Repair Ticket Slip & Tag — ${order.repairNumber}`, slipHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to log repair intake", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transition
  const handleStatusChange = async (repairId: string, newStatus: RepairStatus) => {
    if (!currentUser) return;
    try {
      await updateRepairStatus({
        repairId,
        newStatus,
        userId: currentUser.uid,
        notes: `Status changed to ${newStatus}`,
      });
      showToast(`Repair updated to ${newStatus}`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to update repair status", "error");
    }
  };

  // Handle Delivery Finalization
  const handleDeliverOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepairForDelivery || !activeShift || !currentUser) return;

    const finalVal = parseFloat(finalDeliveryCost) || selectedRepairForDelivery.estimatedCost;

    setIsSubmitting(true);
    try {
      const delivered = await deliverRepairOrder({
        repairId: selectedRepairForDelivery.id,
        finalCost: finalVal,
        deliveryCashierId: currentUser.uid,
        deliveryShiftId: activeShift.id,
        deliveryPaymentMethod: deliveryMethod,
      });

      showToast(`Repair #${delivered.repairNumber} marked as delivered & settled!`, "success");
      setSelectedRepairForDelivery(null);
      refreshData();

      // Print final delivery completion invoice
      const receiptHTML = renderRepairDeliveryReceiptHTML(delivered, activeShop);
      openPrintModal(`Repair Completion Invoice — ${delivered.repairNumber}`, receiptHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to deliver repair order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            Shoe Repair Desk
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Service intake, workshop tracking, claim verification and completion billing.
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setIsIntakeModalOpen(true)}>
          <Plus size={18} /> Receive shoe for repair
        </button>
      </div>

      {/* Filter bar & status breakdown */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Status counters */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-control)" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>Received:</span>
            <span className="badge badge-neutral">{statusCounts.RECEIVED}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-control)" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>In repair:</span>
            <span className="badge badge-primary">{statusCounts.UNDER_REPAIR}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-control)" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>Ready for pickup:</span>
            <span className="badge badge-warning">{statusCounts.READY_FOR_PICKUP}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-control)" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>Collected:</span>
            <span className="badge badge-success">{statusCounts.DELIVERED}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", width: "300px" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search phone, customer or ticket #…"
            value={searchPhoneQuery}
            onChange={(e) => setSearchPhoneQuery(e.target.value)}
            style={{ paddingLeft: "36px", height: "44px", fontSize: "14px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
          {searchPhoneQuery && (
            <button
              type="button"
              onClick={() => setSearchPhoneQuery("")}
              aria-label="Clear search"
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--ink-3)", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Repairs Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          overflow: "hidden",
        }}
      >
        {filteredRepairs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
            No repair service orders matching your criteria. Click &quot;Receive shoe for repair&quot; to intake a shoe.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Customer</th>
                  <th>Shoe description</th>
                  <th>Defect / tasks</th>
                  <th>Promised date</th>
                  <th className="num">Est. cost</th>
                  <th className="num">Advance</th>
                  <th className="num">Balance due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRepairs.map((r) => {
                  const isDelivered = r.status === "DELIVERED";

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                        {r.repairNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--ink)" }}>{r.customerName}</div>
                        <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>{r.customerPhone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--ink)" }}>
                          {r.shoeBrand} {r.shoeModel}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                          {r.shoeColor} · Size {r.shoeSize} {r.isStorePurchased && "· Store bought"}
                        </div>
                      </td>
                      <td style={{ maxWidth: "240px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
                        {r.issueDescription}
                      </td>
                      <td style={{ fontSize: "14px", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                        {formatDate(r.promisedDate)}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(r.estimatedCost)}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--success)" }}>
                        {formatCurrency(r.advancePaid)}
                      </td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: r.balanceDue > 0 ? "var(--warning)" : "var(--ink)" }}>
                        {formatCurrency(r.balanceDue)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === "DELIVERED"
                              ? "badge-success"
                              : r.status === "READY_FOR_PICKUP"
                                ? "badge-warning"
                                : r.status === "UNDER_REPAIR"
                                  ? "badge-primary"
                                  : "badge-neutral"
                          }`}
                        >
                          {r.status === "DELIVERED"
                            ? "Collected"
                            : r.status === "READY_FOR_PICKUP"
                              ? "Ready for pickup"
                              : r.status === "UNDER_REPAIR"
                                ? "In repair"
                                : "Received"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {(currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SHOP_MANAGER") && r.status === "RECEIVED" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatusChange(r.id, "UNDER_REPAIR")}
                              title="Send to Workshop"
                            >
                              To workshop
                            </button>
                          )}

                          {(currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SHOP_MANAGER") && r.status === "UNDER_REPAIR" && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleStatusChange(r.id, "READY_FOR_PICKUP")}
                              title="Mark Finished & Ready"
                            >
                              Ready for pickup
                            </button>
                          )}

                          {r.status === "READY_FOR_PICKUP" && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedRepairForDelivery(r);
                                setFinalDeliveryCost(r.estimatedCost.toString());
                              }}
                              title="Customer Pickup & Billing"
                            >
                              Deliver & settle
                            </button>
                          )}

                          {/* Print Slip Reprint */}
                          <button
                            className="btn btn-secondary btn-sm"
                            aria-label="Print slip"
                            onClick={() => {
                              if (isDelivered) {
                                const finalHTML = renderRepairDeliveryReceiptHTML(r, activeShop);
                                openPrintModal(`Repair Completion Invoice — ${r.repairNumber}`, finalHTML);
                              } else {
                                const slipHTML = renderRepairIntakeSlipHTML(r, activeShop);
                                openPrintModal(`Repair Slip & Tag — ${r.repairNumber}`, slipHTML);
                              }
                            }}
                            title="Print slip"
                          >
                            <Printer size={15} />
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

      {/* SHOE REPAIR INTAKE MODAL */}
      {isIntakeModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleCreateIntake}
            className="modal-panel modal-panel-lg animate-fade-in"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Wrench size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Receive shoe for repair
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Service intake, physical ticket and customer claim slip
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIntakeModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Section 1: Customer Info */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                1. Customer details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Full name *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Ruwan Jayawardena"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Mobile phone *
                  </label>
                  <input
                    type="tel"
                    required
                    className="input-field"
                    placeholder="e.g. 0771234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Shoe Specs */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                2. Shoe specification & origin
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Brand</label>
                  <input type="text" className="input-field" value={shoeBrand} onChange={(e) => setShoeBrand(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Model / style</label>
                  <input type="text" className="input-field" value={shoeModel} onChange={(e) => setShoeModel(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Size</label>
                  <input type="text" className="input-field" value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Colour</label>
                  <input type="text" className="input-field" value={shoeColor} onChange={(e) => setShoeColor(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="storeBought"
                  checked={isStorePurchased}
                  onChange={(e) => setIsStorePurchased(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--primary)" }}
                />
                <label htmlFor="storeBought" style={{ fontSize: "14px", color: "var(--ink-2)", cursor: "pointer" }}>
                  Shoe was originally purchased from our shop branch
                </label>
              </div>
            </div>

            {/* Section 3: Defect & Work */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                3. Defect diagnosis & required work
              </div>
              <textarea
                required
                rows={3}
                className="input-field"
                placeholder="Describe required service work (e.g. Left sole detachment, re-stitching, heel replacement)..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                style={{ height: "auto", padding: "10px 12px" }}
              />
            </div>

            {/* Section 4: Charges, Advance & Dates */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                4. Billing estimate & advance deposit
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Estimated total fee (Rs.) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="input-field"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Advance deposit (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value)}
                    style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "var(--success)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Deposit payment mode
                  </label>
                  <select
                    className="input-field"
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value as any)}
                  >
                    <option value="CASH">Cash (Shift drawer)</option>
                    <option value="CARD">Card payment</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                  Promised turnaround (Days):
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="input-field"
                  value={promisedDays}
                  onChange={(e) => setPromisedDays(e.target.value)}
                  style={{ width: "120px", fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, height: "48px" }} onClick={() => setIsIntakeModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, height: "48px" }} disabled={isSubmitting}>
                <Printer size={16} />
                {isSubmitting ? "Saving…" : "Save & print claim slip"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FINAL PICKUP & SETTLEMENT MODAL */}
      {selectedRepairForDelivery && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleDeliverOrder}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "460px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Repair delivery & final settlement
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Ticket #{selectedRepairForDelivery.repairNumber}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRepairForDelivery(null)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-control)", marginBottom: "20px", fontSize: "13px", lineHeight: "1.6" }}>
              <div><strong style={{ color: "var(--ink)" }}>Ticket:</strong> {selectedRepairForDelivery.repairNumber}</div>
              <div><strong style={{ color: "var(--ink)" }}>Customer:</strong> {selectedRepairForDelivery.customerName} ({selectedRepairForDelivery.customerPhone})</div>
              <div><strong style={{ color: "var(--ink)" }}>Shoe:</strong> {selectedRepairForDelivery.shoeBrand} {selectedRepairForDelivery.shoeModel}</div>
              <div><strong style={{ color: "var(--ink)" }}>Advance already paid:</strong> <span style={{ color: "var(--success)", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(selectedRepairForDelivery.advancePaid)}</span></div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Final total service charge (Rs.)
              </label>
              <input
                type="number"
                min="0"
                required
                className="input-field"
                value={finalDeliveryCost}
                onChange={(e) => setFinalDeliveryCost(e.target.value)}
                style={{ fontSize: "16px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            {/* Calculated Final Balance Due */}
            <div
              style={{
                padding: "14px 16px",
                background: "var(--primary-soft)",
                border: "1px solid var(--primary-soft-line)",
                borderRadius: "var(--radius-control)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: "600",
                fontSize: "15px",
                marginBottom: "20px",
              }}
            >
              <span style={{ color: "var(--primary-ink)" }}>Balance to collect now:</span>
              <span style={{ color: "var(--ink)", fontSize: "18px", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(
                  Math.max(
                    0,
                    (parseFloat(finalDeliveryCost) || selectedRepairForDelivery.estimatedCost) -
                    selectedRepairForDelivery.advancePaid
                  )
                )}
              </span>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                Payment method for balance
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  style={{
                    height: "44px",
                    borderRadius: "var(--radius-control)",
                    background: deliveryMethod === "CASH" ? "var(--primary)" : "var(--surface)",
                    color: deliveryMethod === "CASH" ? "#ffffff" : "var(--ink)",
                    border: deliveryMethod === "CASH" ? "1px solid var(--primary)" : "1px solid var(--line-strong)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: "600",
                    fontFamily: "inherit",
                  }}
                  onClick={() => setDeliveryMethod("CASH")}
                >
                  <Banknote size={16} /> Cash (Shift drawer)
                </button>
                <button
                  type="button"
                  style={{
                    height: "44px",
                    borderRadius: "var(--radius-control)",
                    background: deliveryMethod === "CARD" ? "var(--primary)" : "var(--surface)",
                    color: deliveryMethod === "CARD" ? "#ffffff" : "var(--ink)",
                    border: deliveryMethod === "CARD" ? "1px solid var(--primary)" : "1px solid var(--line-strong)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: "600",
                    fontFamily: "inherit",
                  }}
                  onClick={() => setDeliveryMethod("CARD")}
                >
                  <CreditCard size={16} /> Card payment
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setSelectedRepairForDelivery(null)}
              >
                Back
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, height: "48px" }} disabled={isSubmitting}>
                <CheckCircle2 size={16} />
                {isSubmitting ? "Completing…" : "Deliver & print invoice"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
