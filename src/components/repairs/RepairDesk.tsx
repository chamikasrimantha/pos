// src/components/repairs/RepairDesk.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getRepairOrders,
  createRepairOrder,
  updateRepairStatus,
  deliverRepairOrder,
  verifyRepairWarranty,
  convertWarrantyRepairToPaid,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderRepairIntakeSlipHTML,
  renderRepairDeliveryReceiptHTML,
} from "@/lib/receipt-generator";
import { ShoeRepairOrder, RepairStatus } from "@/types";
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Printer,
  X,
  CreditCard,
  Banknote,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ShoppingBag,
  Footprints,
  RotateCcw,
} from "lucide-react";

const FOOTWEAR_SUBTYPES = ["Shoe", "Slipper or sandal", "Boot", "Other"];
const BAG_SUBTYPES = ["Luggage bag", "School bag", "Travel bag", "Travel pouch", "Other"];

const FOOTWEAR_DEFECT_CHIPS = [
  "Sole detached",
  "Heel replacement",
  "Re-stitching",
  "Zip replacement",
  "Glue separation",
];

const BAG_DEFECT_CHIPS = [
  "Zip broken / replace",
  "Handle / strap repair",
  "Wheel replacement",
  "Lock mechanism",
  "Stitching torn",
];

export function RepairDesk() {
  const {
    activeShop,
    currentUser,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [searchPhoneQuery, setSearchPhoneQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "FOOTWEAR" | "BAG">("ALL");
  const [filterWarranty, setFilterWarranty] = useState<"ALL" | "WARRANTY" | "PAID">("ALL");

  // Intake Form State
  const [itemType, setItemType] = useState<"FOOTWEAR" | "BAG">("FOOTWEAR");
  const [subType, setSubType] = useState("Shoe");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [brand, setBrand] = useState("Clarks");
  const [model, setModel] = useState("Leather Loafer");
  const [size, setSize] = useState("42");
  const [color, setColor] = useState("Brown");
  const [dimension, setDimension] = useState("");
  const [isStorePurchased, setIsStorePurchased] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");

  // Warranty State
  const [isWarranty, setIsWarranty] = useState(false);
  const [warrantyBasis, setWarrantyBasis] = useState<"STORE_INVOICE" | "MANUAL">("STORE_INVOICE");
  const [warrantyInvoiceNumber, setWarrantyInvoiceNumber] = useState("");
  const [warrantyCardNumber, setWarrantyCardNumber] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState<"VERIFIED" | "UNVERIFIED" | "EXPIRED" | "NOT_FOUND" | null>(null);
  const [warrantyVerificationMsg, setWarrantyVerificationMsg] = useState("");
  const [isVerifyingInvoice, setIsVerifyingInvoice] = useState(false);

  // Billing Estimate State
  const [hasEstimate, setHasEstimate] = useState(true);
  const [estimatedCost, setEstimatedCost] = useState("2500");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [advanceMethod, setAdvanceMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [promisedDays, setPromisedDays] = useState("3");
  const [intakeNotes, setIntakeNotes] = useState("");

  // Delivery Modal State
  const [selectedRepairForDelivery, setSelectedRepairForDelivery] = useState<ShoeRepairOrder | null>(null);
  const [finalDeliveryCost, setFinalDeliveryCost] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert Warranty Modal State (Super Admin Only)
  const [repairToConvert, setRepairToConvert] = useState<ShoeRepairOrder | null>(null);
  const [convertFee, setConvertFee] = useState("2500");
  const [convertReason, setConvertReason] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Load repairs
  const repairs = useMemo(() => {
    return getRepairOrders(activeShop.id);
  }, [activeShop.id, dataVersion]);

  // Filtered repairs
  const filteredRepairs = useMemo(() => {
    const q = searchPhoneQuery.toLowerCase().trim();
    return repairs.filter((r) => {
      // Search filter
      if (q) {
        const matchesQuery =
          r.customerPhone.includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.repairNumber.toLowerCase().includes(q) ||
          (r.brand && r.brand.toLowerCase().includes(q)) ||
          (r.shoeBrand && r.shoeBrand.toLowerCase().includes(q)) ||
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.shoeModel && r.shoeModel.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Type filter
      if (filterType !== "ALL") {
        const orderType = r.itemType || "FOOTWEAR";
        if (orderType !== filterType) return false;
      }

      // Warranty filter
      if (filterWarranty === "WARRANTY" && !r.isWarranty) return false;
      if (filterWarranty === "PAID" && r.isWarranty) return false;

      return true;
    });
  }, [repairs, searchPhoneQuery, filterType, filterWarranty]);

  // Status breakdown
  const statusCounts = useMemo(() => {
    return {
      RECEIVED: repairs.filter((r) => r.status === "RECEIVED").length,
      UNDER_REPAIR: repairs.filter((r) => r.status === "UNDER_REPAIR").length,
      READY_FOR_PICKUP: repairs.filter((r) => r.status === "READY_FOR_PICKUP").length,
      DELIVERED: repairs.filter((r) => r.status === "DELIVERED").length,
      WARRANTY_UNVERIFIED: repairs.filter((r) => r.isWarranty && r.warrantyStatus === "UNVERIFIED").length,
    };
  }, [repairs]);

  // Switch Item Type helper
  const handleItemTypeChange = (newType: "FOOTWEAR" | "BAG") => {
    setItemType(newType);
    if (newType === "FOOTWEAR") {
      setSubType(FOOTWEAR_SUBTYPES[0]);
      setBrand("Clarks");
      setModel("Leather Loafer");
      setSize("42");
      setColor("Brown");
      setIssueDescription("Sole detached at toe; restitch and glue.");
    } else {
      setSubType(BAG_SUBTYPES[0]);
      setBrand("Delsey");
      setModel("Cabin Trolley");
      setSize("24 inch");
      setColor("Black");
      setDimension("55 x 35 x 25 cm");
      setIssueDescription("Zip runner stuck and torn fabric near handle.");
    }
    // Reset warranty check on type switch
    setWarrantyStatus(null);
    setWarrantyVerificationMsg("");
  };

  // Quick pick defect chip
  const handleAddDefectChip = (text: string) => {
    if (!issueDescription) {
      setIssueDescription(text);
    } else if (!issueDescription.includes(text)) {
      setIssueDescription(`${issueDescription}; ${text}`);
    }
  };

  // Verify Warranty against Store Invoice
  const handleVerifyInvoice = () => {
    if (!warrantyInvoiceNumber.trim()) {
      showToast("Please enter an invoice number to verify", "error");
      return;
    }
    if (!currentUser) return;

    setIsVerifyingInvoice(true);
    try {
      const res = verifyRepairWarranty({
        shopId: activeShop.id,
        invoiceNumber: warrantyInvoiceNumber.trim(),
        itemType,
        callingUser: currentUser,
      });

      setWarrantyStatus(res.status);
      setWarrantyVerificationMsg(res.message);

      if (res.status === "VERIFIED") {
        showToast("Warranty verified successfully!", "success");
        setIsStorePurchased(true);
      } else if (res.status === "EXPIRED") {
        showToast("Invoice found but warranty has expired", "info");
        // Expired leaves the switch off by default
        setIsWarranty(false);
      } else {
        showToast("Invoice not found at this branch", "info");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to verify warranty", "error");
    } finally {
      setIsVerifyingInvoice(false);
    }
  };

  // Submit Intake
  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast("Cannot accept repair: User session required.", "error");
      return;
    }

    const est = isWarranty ? 0 : hasEstimate ? (parseFloat(estimatedCost) || 0) : 0;
    const adv = isWarranty ? 0 : hasEstimate ? (parseFloat(advancePaid) || 0) : 0;
    const days = parseInt(promisedDays) || 3;
    const promisedTimestamp = Date.now() + days * 86400000;

    setIsSubmitting(true);
    try {
      const order = await createRepairOrder({
        shopId: activeShop.id,
        intakeCashierId: currentUser.uid,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim() || undefined,
        itemType,
        subType,
        brand: brand.trim(),
        model: model.trim(),
        size: size.trim(),
        color: color.trim(),
        dimension: itemType === "BAG" ? dimension.trim() || undefined : undefined,
        isStorePurchased: isWarranty && warrantyBasis === "STORE_INVOICE" ? true : isStorePurchased,
        issueDescription: issueDescription.trim(),
        estimatedCost: est,
        advancePaid: adv,
        advancePaymentMethod: adv > 0 ? advanceMethod : undefined,
        promisedDate: promisedTimestamp,
        notes: intakeNotes.trim() || undefined,
        isWarranty,
        warrantyBasis: isWarranty ? warrantyBasis : undefined,
        warrantyInvoiceNumber: isWarranty && warrantyBasis === "STORE_INVOICE" ? warrantyInvoiceNumber.trim() : undefined,
        warrantyCardNumber: isWarranty && warrantyBasis === "MANUAL" ? warrantyCardNumber.trim() : undefined,
        warrantyStatus: isWarranty
          ? warrantyBasis === "STORE_INVOICE"
            ? (warrantyStatus || "VERIFIED")
            : "UNVERIFIED"
          : undefined,
        hasEstimate: isWarranty ? false : hasEstimate,
      });

      showToast(`Repair job #${order.repairNumber} logged!`, "success");
      setIsIntakeModalOpen(false);
      refreshData();

      // Automatically pop Customer Intake Claim Slip & Workshop Attachment Tag
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
    if (!selectedRepairForDelivery || !currentUser) return;

    const isWarr = !!selectedRepairForDelivery.isWarranty;
    const finalVal = isWarr
      ? 0
      : selectedRepairForDelivery.hasEstimate === false
        ? (parseFloat(finalDeliveryCost) || 0)
        : (parseFloat(finalDeliveryCost) || selectedRepairForDelivery.estimatedCost);

    setIsSubmitting(true);
    try {
      const delivered = await deliverRepairOrder({
        repairId: selectedRepairForDelivery.id,
        finalCost: finalVal,
        deliveryCashierId: currentUser.uid,
        deliveryPaymentMethod: isWarr ? null : deliveryMethod,
      });

      showToast(`Repair #${delivered.repairNumber} delivered & completed!`, "success");
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

  // Handle Super Admin Warranty Conversion to Paid
  const handleConvertWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairToConvert || !currentUser) return;

    const fee = parseFloat(convertFee) || 0;
    if (fee <= 0) {
      showToast("Please enter a valid estimated fee", "error");
      return;
    }
    if (!convertReason.trim()) {
      showToast("Please enter a reason for converting the warranty repair", "error");
      return;
    }

    setIsConverting(true);
    try {
      await convertWarrantyRepairToPaid({
        repairId: repairToConvert.id,
        estimatedCost: fee,
        callingUser: currentUser,
        reason: convertReason.trim(),
      });

      showToast(`Repair #${repairToConvert.repairNumber} converted to paid service.`, "success");
      setRepairToConvert(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to convert warranty repair", "error");
    } finally {
      setIsConverting(false);
    }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            Repair Desk (Shoes & Bags)
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Service intake, workshop tracking, warranty claim verification and completion billing.
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setIsIntakeModalOpen(true)}>
          <Plus size={18} /> Receive item for repair
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

          {statusCounts.WARRANTY_UNVERIFIED > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "#fef3c7", borderRadius: "var(--radius-control)" }}>
              <ShieldAlert size={14} color="#d97706" />
              <span style={{ fontSize: "13px", color: "#92400e", fontWeight: "600" }}>Unverified warranties:</span>
              <span className="badge badge-warning">{statusCounts.WARRANTY_UNVERIFIED}</span>
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Item Type filter */}
          <select
            className="input-field"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ width: "130px", height: "40px", fontSize: "13px" }}
          >
            <option value="ALL">All types</option>
            <option value="FOOTWEAR">Footwear</option>
            <option value="BAG">Bags</option>
          </select>

          {/* Warranty filter */}
          <select
            className="input-field"
            value={filterWarranty}
            onChange={(e) => setFilterWarranty(e.target.value as any)}
            style={{ width: "130px", height: "40px", fontSize: "13px" }}
          >
            <option value="ALL">All billing</option>
            <option value="WARRANTY">Warranty</option>
            <option value="PAID">Paid repair</option>
          </select>

          {/* Search box */}
          <div style={{ position: "relative", width: "240px" }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search phone, ticket #…"
              value={searchPhoneQuery}
              onChange={(e) => setSearchPhoneQuery(e.target.value)}
              style={{ paddingLeft: "34px", height: "40px", fontSize: "13px" }}
            />
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
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
      </div>

      {/* Repairs Table */}
      <div className="pos-table-container">
        {filteredRepairs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-2)", fontSize: "14px" }}>
            No repair service orders matching your criteria. Click &quot;Receive item for repair&quot; to intake shoes or bags.
          </div>
        ) : (
          <div className="pos-table-scroll">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Customer</th>
                  <th>Item description</th>
                  <th>Defect / diagnosis</th>
                  <th>Promised</th>
                  <th className="num">Est. cost</th>
                  <th className="num">Advance</th>
                  <th className="num">Balance due</th>
                  <th>Billing / Warranty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRepairs.map((r) => {
                  const isDelivered = r.status === "DELIVERED";
                  const itemIsBag = r.itemType === "BAG";
                  const brandName = r.brand || r.shoeBrand || "Generic";
                  const modelName = r.model || r.shoeModel || "";
                  const sizeVal = r.size || r.shoeSize || "";
                  const colorVal = r.color || r.shoeColor || "";
                  const subTypeVal = r.subType || (itemIsBag ? "Bag" : "Shoe");

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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: itemIsBag ? "#fef3c7" : "#e0e7ff",
                              color: itemIsBag ? "#92400e" : "#3730a3",
                            }}
                          >
                            {subTypeVal}
                          </span>
                          <span style={{ fontWeight: "600", color: "var(--ink)" }}>
                            {brandName} {modelName}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "2px" }}>
                          {colorVal} {sizeVal && `· Sz ${sizeVal}`} {r.dimension && `· Dim: ${r.dimension}`}
                        </div>
                      </td>
                      <td style={{ maxWidth: "200px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
                        {r.issueDescription}
                      </td>
                      <td style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", color: "var(--ink)", whiteSpace: "nowrap" }}>
                        {formatDate(r.promisedDate)}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {r.isWarranty ? (
                          <span style={{ color: "var(--success)", fontWeight: "600" }}>Rs. 0</span>
                        ) : r.hasEstimate === false ? (
                          <span style={{ fontSize: "12px", color: "var(--ink-3)", fontStyle: "italic" }}>To be advised</span>
                        ) : (
                          formatCurrency(r.estimatedCost)
                        )}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--success)" }}>
                        {formatCurrency(r.advancePaid)}
                      </td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", color: r.balanceDue > 0 ? "var(--warning)" : "var(--ink)" }}>
                        {r.isWarranty ? "Rs. 0" : formatCurrency(r.balanceDue)}
                      </td>
                      <td>
                        {r.isWarranty ? (
                          <span
                            className={`badge ${r.warrantyStatus === "UNVERIFIED" ? "badge-warning" : "badge-success"}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            {r.warrantyStatus === "UNVERIFIED" ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                            {r.warrantyStatus === "UNVERIFIED" ? "Warranty (Unverified)" : "Warranty"}
                          </span>
                        ) : r.isWarrantyConvertedToPaid ? (
                          <span className="badge badge-neutral" title={`Converted: ${r.convertedToPaidReason || "Super Admin"}`}>
                            Converted to Paid
                          </span>
                        ) : (
                          <span className="badge badge-neutral">Paid repair</span>
                        )}
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
                              Ready
                            </button>
                          )}

                          {r.status === "READY_FOR_PICKUP" && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedRepairForDelivery(r);
                                setFinalDeliveryCost(r.isWarranty ? "0" : r.estimatedCost.toString());
                              }}
                              title="Customer Pickup & Final Delivery"
                            >
                              Deliver
                            </button>
                          )}

                          {/* Super Admin Warranty to Paid conversion button */}
                          {currentUser?.role === "SUPER_ADMIN" && r.isWarranty && r.status !== "DELIVERED" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setRepairToConvert(r);
                                setConvertFee("2500");
                                setConvertReason("");
                              }}
                              title="Convert warranty claim to paid repair"
                              style={{ color: "#b45309" }}
                            >
                              <RotateCcw size={14} /> To paid
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

      {/* REPAIR INTAKE MODAL (SHOES & BAGS) */}
      {isIntakeModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleCreateIntake}
            className="modal-panel modal-panel-lg animate-fade-in"
            style={{ maxHeight: "92vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Wrench size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Receive item for repair
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Intake shoes, slippers, boots and bags with claim slip & workshop tag
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

            {/* Item Type Selector Tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => handleItemTypeChange("FOOTWEAR")}
                style={{
                  height: "46px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  borderRadius: "var(--radius-control)",
                  border: itemType === "FOOTWEAR" ? "2px solid var(--primary)" : "1px solid var(--line-strong)",
                  background: itemType === "FOOTWEAR" ? "var(--primary-soft)" : "var(--surface)",
                  color: itemType === "FOOTWEAR" ? "var(--primary)" : "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <Footprints size={18} /> Footwear (Shoes, Slippers, Boots)
              </button>

              <button
                type="button"
                onClick={() => handleItemTypeChange("BAG")}
                style={{
                  height: "46px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  borderRadius: "var(--radius-control)",
                  border: itemType === "BAG" ? "2px solid var(--primary)" : "1px solid var(--line-strong)",
                  background: itemType === "BAG" ? "var(--primary-soft)" : "var(--surface)",
                  color: itemType === "BAG" ? "var(--primary)" : "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <ShoppingBag size={18} /> Bags (Luggage, School, Travel)
              </button>
            </div>

            {/* Section 1: Customer Info */}
            <div style={{ marginBottom: "20px", background: "var(--canvas)", padding: "14px", borderRadius: "var(--radius-control)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                1. Customer details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
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
                  <label style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
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
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                    Address (optional)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Colombo 03"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Item Specification */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", marginBottom: "8px" }}>
                2. {itemType === "BAG" ? "Bag" : "Footwear"} specification
              </div>
              <div style={{ display: "grid", gridTemplateColumns: itemType === "BAG" ? "1.2fr 1.2fr 1.2fr 1fr 1.2fr" : "1.2fr 1.2fr 1.2fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Category</label>
                  <select
                    className="input-field"
                    value={subType}
                    onChange={(e) => setSubType(e.target.value)}
                  >
                    {(itemType === "BAG" ? BAG_SUBTYPES : FOOTWEAR_SUBTYPES).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Brand</label>
                  <input type="text" className="input-field" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Model / name</label>
                  <input type="text" className="input-field" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Colour</label>
                  <input type="text" className="input-field" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
                {itemType === "FOOTWEAR" ? (
                  <div>
                    <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Size</label>
                    <input type="text" className="input-field" value={size} onChange={(e) => setSize(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>Dimension / size</label>
                    <input type="text" className="input-field" placeholder="e.g. 24 inch / 55L" value={dimension} onChange={(e) => setDimension(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Defect Diagnosis & Quick Chips */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>
                  3. Defect diagnosis & required work *
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Click quick chips to add:</div>
              </div>

              {/* Quick defect chips */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                {(itemType === "BAG" ? BAG_DEFECT_CHIPS : FOOTWEAR_DEFECT_CHIPS).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddDefectChip(chip)}
                    style={{
                      fontSize: "12px",
                      padding: "4px 10px",
                      borderRadius: "14px",
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                required
                rows={3}
                className="input-field"
                placeholder="Describe required service work in detail..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                style={{ height: "auto", padding: "10px 12px" }}
              />
            </div>

            {/* Section 4: Warranty Options */}
            <div style={{ marginBottom: "20px", background: isWarranty ? "#f0fdf4" : "var(--canvas)", padding: "14px", borderRadius: "var(--radius-control)", border: isWarranty ? "1px solid #86efac" : "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={18} color={isWarranty ? "#16a34a" : "var(--ink-3)"} />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: isWarranty ? "#15803d" : "var(--ink)" }}>
                    Warranty option
                  </span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
                  <input
                    type="checkbox"
                    checked={isWarranty}
                    onChange={(e) => {
                      setIsWarranty(e.target.checked);
                      if (e.target.checked) setHasEstimate(false);
                    }}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  Under warranty (free repair)
                </label>
              </div>

              {isWarranty && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #bbf7d0" }}>
                  {/* Basis Radio */}
                  <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                      <input
                        type="radio"
                        name="warrantyBasis"
                        checked={warrantyBasis === "STORE_INVOICE"}
                        onChange={() => setWarrantyBasis("STORE_INVOICE")}
                      />
                      Bought from this shop (Verify store invoice)
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                      <input
                        type="radio"
                        name="warrantyBasis"
                        checked={warrantyBasis === "MANUAL"}
                        onChange={() => setWarrantyBasis("MANUAL")}
                      />
                      Manual warranty card / note
                    </label>
                  </div>

                  {warrantyBasis === "STORE_INVOICE" ? (
                    <div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Enter invoice number (e.g. RW-INV-001001)"
                          value={warrantyInvoiceNumber}
                          onChange={(e) => setWarrantyInvoiceNumber(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleVerifyInvoice}
                          disabled={isVerifyingInvoice}
                          style={{ height: "40px" }}
                        >
                          {isVerifyingInvoice ? "Checking…" : "Verify invoice"}
                        </button>
                      </div>

                      {warrantyStatus && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px 12px",
                            borderRadius: "var(--radius-control)",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            background:
                              warrantyStatus === "VERIFIED"
                                ? "#dcfce7"
                                : warrantyStatus === "EXPIRED"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                            color:
                              warrantyStatus === "VERIFIED"
                                ? "#166534"
                                : warrantyStatus === "EXPIRED"
                                  ? "#991b1b"
                                  : "#92400e",
                          }}
                        >
                          {warrantyStatus === "VERIFIED" ? (
                            <ShieldCheck size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <span><strong>{warrantyStatus}:</strong> {warrantyVerificationMsg}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                        Warranty card number or customer claim note *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="e.g. CARD-98432 or 'Purchased promotional bag last month'"
                        value={warrantyCardNumber}
                        onChange={(e) => setWarrantyCardNumber(e.target.value)}
                      />
                      <div style={{ fontSize: "12px", color: "#b45309", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <ShieldAlert size={14} />
                        Manual claims are saved as Unverified and sent to the Review Inbox for Super Admin approval.
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "10px", fontSize: "12px", color: "#166534" }}>
                    ✓ Fee is set to Rs. 0. No advance deposit taken. No payment collected at delivery.
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Billing Estimate & Advance Deposit (if not warranty) */}
            {!isWarranty && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>
                    4. Billing estimate & advance deposit
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={hasEstimate}
                      onChange={(e) => setHasEstimate(e.target.checked)}
                      style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                    />
                    Give a billing estimate
                  </label>
                </div>

                {hasEstimate ? (
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
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card payment</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-control)", border: "1px dashed var(--line-strong)", fontSize: "13px", color: "var(--ink-2)" }}>
                    <strong>Estimate turned off:</strong> Intake slip will print &quot;Estimate to be advised&quot;. The final service cost will be entered upon completion / delivery.
                  </div>
                )}
              </div>
            )}

            {/* Promised Turnaround Days */}
            <div style={{ marginBottom: "24px", display: "flex", gap: "16px", alignItems: "center" }}>
              <div>
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

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "13px", color: "var(--ink-2)", display: "block", marginBottom: "4px" }}>
                  Internal technician notes (optional):
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Customer requested extra stitching on left handle..."
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, height: "48px" }} onClick={() => setIsIntakeModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, height: "48px" }} disabled={isSubmitting}>
                <Printer size={16} />
                {isSubmitting ? "Saving…" : "Save & print claim slip & tag"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FINAL PICKUP & DELIVERY MODAL */}
      {selectedRepairForDelivery && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleDeliverOrder}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Repair delivery & settlement
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

            {/* Item & Customer Summary */}
            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-control)", marginBottom: "16px", fontSize: "13px", lineHeight: "1.6" }}>
              <div><strong style={{ color: "var(--ink)" }}>Ticket:</strong> {selectedRepairForDelivery.repairNumber}</div>
              <div><strong style={{ color: "var(--ink)" }}>Customer:</strong> {selectedRepairForDelivery.customerName} ({selectedRepairForDelivery.customerPhone})</div>
              <div><strong style={{ color: "var(--ink)" }}>Article:</strong> {selectedRepairForDelivery.brand || selectedRepairForDelivery.shoeBrand} {selectedRepairForDelivery.model || selectedRepairForDelivery.shoeModel} ({selectedRepairForDelivery.subType || (selectedRepairForDelivery.itemType === "BAG" ? "Bag" : "Shoe")})</div>
              {selectedRepairForDelivery.isWarranty ? (
                <div style={{ color: "#16a34a", fontWeight: "700", marginTop: "4px" }}>
                  ✓ Under Warranty — Service is Free of Charge
                </div>
              ) : (
                <div><strong style={{ color: "var(--ink)" }}>Advance already paid:</strong> <span style={{ color: "var(--success)", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(selectedRepairForDelivery.advancePaid)}</span></div>
              )}
            </div>

            {/* If Warranty: 0 cost notice */}
            {selectedRepairForDelivery.isWarranty ? (
              <div style={{ padding: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius-control)", marginBottom: "20px", textAlign: "center" }}>
                <ShieldCheck size={28} color="#16a34a" style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#166534" }}>Warranty Service — No Payment Required</div>
                <div style={{ fontSize: "13px", color: "#15803d", marginTop: "4px" }}>
                  Click deliver to complete order and print the &quot;Warranty service — no charge&quot; customer invoice.
                </div>
              </div>
            ) : (
              <>
                {/* Cost Input for Paid Repair */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                    Final total service charge (Rs.) {selectedRepairForDelivery.hasEstimate === false && "(No estimate was given during intake)"}
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
                    marginBottom: "16px",
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

                {/* Payment mode buttons */}
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
                      }}
                      onClick={() => setDeliveryMethod("CASH")}
                    >
                      <Banknote size={16} /> Cash
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
                      }}
                      onClick={() => setDeliveryMethod("CARD")}
                    >
                      <CreditCard size={16} /> Card payment
                    </button>
                  </div>
                </div>
              </>
            )}

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

      {/* SUPER ADMIN CONVERT WARRANTY TO PAID MODAL */}
      {repairToConvert && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleConvertWarranty}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "440px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <RotateCcw size={22} style={{ color: "#b45309" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                    Convert warranty to paid repair
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                    Ticket #{repairToConvert.repairNumber}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRepairToConvert(null)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "16px", lineHeight: "1.5" }}>
              As Super Admin, you can convert this free warranty claim to a paid repair if the defect is not covered by the warranty (e.g. physical customer damage or water damage).
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                New estimated service charge (Rs.) *
              </label>
              <input
                type="number"
                min="0"
                required
                className="input-field"
                value={convertFee}
                onChange={(e) => setConvertFee(e.target.value)}
                style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Reason for converting to paid *
              </label>
              <textarea
                required
                rows={3}
                className="input-field"
                placeholder="e.g. Defect caused by external cuts/tears, not covered under manufacturer warranty..."
                value={convertReason}
                onChange={(e) => setConvertReason(e.target.value)}
                style={{ height: "auto", padding: "8px 10px", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "44px" }}
                onClick={() => setRepairToConvert(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1.5, height: "44px", background: "#b45309", borderColor: "#b45309" }}
                disabled={isConverting}
              >
                {isConverting ? "Converting…" : "Convert to paid"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
