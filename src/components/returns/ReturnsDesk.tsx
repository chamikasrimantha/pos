// src/components/returns/ReturnsDesk.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  findSaleByInvoice,
  processCustomerReturn,
  getVariants,
} from "@/lib/firestore-service";
import { formatCurrency, formatDate } from "@/lib/receipt-generator";
import { Sale, SaleItem, ReturnItem, ProductVariant, RefundMethod } from "@/types";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Receipt,
  Boxes,
  HelpCircle,
} from "lucide-react";

export function ReturnsDesk() {
  const {
    activeShop,
    currentUser,
    activeShift,
    settings,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState("");
  const [loadedSale, setLoadedSale] = useState<Sale | null>(null);
  const [loadedItems, setLoadedItems] = useState<SaleItem[]>([]);

  // Selected return items mapping: saleItemId -> { selected: boolean, quantity: number, condition, reason }
  const [returnConfig, setReturnConfig] = useState<
    Record<
      string,
      {
        selected: boolean;
        quantity: number;
        condition: "NEW_RESELLABLE" | "DEFECTIVE";
        reason: "SIZE_FIT" | "DEFECT" | "CUSTOMER_CHOICE";
      }
    >
  >({});

  // Mode: DIRECT_REFUND vs SIZE_EXCHANGE
  const [mode, setMode] = useState<"REFUND" | "EXCHANGE">("REFUND");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [selectedReplacementVariantId, setSelectedReplacementVariantId] = useState<string>("");
  const [returnNotes, setReturnNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allVariants = useMemo(() => getVariants(), [dataVersion]);

  // Lookup Sale by Invoice
  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInvoiceNumber.trim()) return;

    const res = findSaleByInvoice(searchInvoiceNumber.trim());
    if (!res) {
      showToast(`No completed sale found matching invoice: ${searchInvoiceNumber}`, "error");
      return;
    }

    setLoadedSale(res.sale);
    setLoadedItems(res.items);

    // Initialize returnConfig
    const config: Record<string, any> = {};
    res.items.forEach((it) => {
      const remaining = it.quantity - it.returnedQuantity;
      config[it.id] = {
        selected: false,
        quantity: remaining > 0 ? 1 : 0,
        condition: "NEW_RESELLABLE",
        reason: "SIZE_FIT",
      };
    });
    setReturnConfig(config);
    showToast(`Loaded invoice #${res.sale.invoiceNumber}`, "success");
  };

  // Calculate gross refund value
  const grossRefundTotal = useMemo(() => {
    if (!loadedSale) return 0;
    return loadedItems.reduce((sum, it) => {
      const conf = returnConfig[it.id];
      if (conf && conf.selected && conf.quantity > 0) {
        return sum + it.unitSellingPrice * conf.quantity;
      }
      return sum;
    }, 0);
  }, [loadedSale, loadedItems, returnConfig]);

  // Selected replacement variant (for size exchange)
  const replacementVariant = useMemo(() => {
    if (!selectedReplacementVariantId) return null;
    return allVariants.find((v) => v.id === selectedReplacementVariantId) || null;
  }, [selectedReplacementVariantId, allVariants]);

  // Net calculation in exchange
  const exchangeDelta = useMemo(() => {
    if (!replacementVariant) return 0;
    const replacementCost = replacementVariant.sellingPrice;
    return replacementCost - grossRefundTotal;
  }, [replacementVariant, grossRefundTotal]);

  // Process Return / Exchange
  const handleSubmitReturn = async () => {
    if (!activeShift || !currentUser) {
      showToast("Cannot process return: Active open cashier shift is required.", "error");
      return;
    }
    if (!loadedSale) return;

    // Policy Check 1: Return window (Section 6.4 & 5.4)
    const returnWindowDays = settings?.returnWindowDays || 14;
    const returnWindowMs = returnWindowDays * 86400000;
    const isOutsideWindow = Date.now() - loadedSale.saleDate > returnWindowMs;
    if (isOutsideWindow && currentUser.role === "CASHIER") {
      showToast(`Return window of ${returnWindowDays} days has expired (sold on ${formatDate(loadedSale.saleDate)}). Manager approval required.`, "error");
      return;
    }

    // Policy Check 2: Cashier cash refund cap (Section 5.4)
    const refundCap = currentUser.cashRefundCap || settings?.cashierRefundCap || 3000;
    if (mode === "REFUND" && refundMethod === "CASH" && grossRefundTotal > refundCap && currentUser.role === "CASHIER") {
      showToast(`Cash refund of ${formatCurrency(grossRefundTotal)} exceeds cashier limit of ${formatCurrency(refundCap)}. Manager approval required.`, "error");
      return;
    }

    const itemsToReturn: ReturnItem[] = [];
    loadedItems.forEach((it) => {
      const conf = returnConfig[it.id];
      if (conf && conf.selected && conf.quantity > 0) {
        itemsToReturn.push({
          variantId: it.variantId,
          quantity: conf.quantity,
          unitPriceRefunded: it.unitSellingPrice,
          condition: conf.condition,
          restocked: conf.condition === "NEW_RESELLABLE",
          reason: conf.reason,
          variantDescriptionCache: it.variantDescriptionCache,
        });
      }
    });

    if (itemsToReturn.length === 0) {
      showToast("Please select at least one item to return.", "error");
      return;
    }

    if (mode === "EXCHANGE" && !replacementVariant) {
      showToast("Please select a replacement shoe variant for the size exchange.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const returnDoc = await processCustomerReturn({
        shopId: activeShop.id,
        originalSale: loadedSale,
        items: itemsToReturn,
        refundMethod: mode === "EXCHANGE" ? "EVEN_EXCHANGE" : refundMethod,
        cashierId: currentUser.uid,
        shiftId: activeShift.id,
        notes: returnNotes.trim() || undefined,
        exchangeReplacement:
          mode === "EXCHANGE" && replacementVariant
            ? {
                variant: replacementVariant,
                quantity: 1,
                price: replacementVariant.sellingPrice,
              }
            : undefined,
      });

      showToast(`Return slip #${returnDoc.returnNumber} generated successfully!`, "success");
      refreshData();

      // Printable Return Voucher
      const returnVoucherHTML = `
        <div style="font-family: monospace; width: 300px; margin: 0 auto; padding: 14px; color: #111;">
          <div style="text-align: center; border-bottom: 1px dashed #333; padding-bottom: 8px;">
            <h3 style="margin: 0;">${activeShop.name}</h3>
            <div style="font-size: 13px; font-weight: bold; margin-top: 4px;">RETURN & EXCHANGE RECEIPT</div>
            <div style="font-size: 11px;">${returnDoc.returnNumber}</div>
          </div>
          <div style="font-size: 12px; margin: 8px 0;">
            <div>Date: ${formatDate(returnDoc.createdAt)}</div>
            <div>Original Inv: ${returnDoc.originalInvoiceNumber}</div>
            <div>Cashier: ${currentUser.displayName}</div>
            <div>Type: ${returnDoc.type}</div>
          </div>
          <table style="width: 100%; font-size: 11px; border-top: 1px dashed #333; border-bottom: 1px dashed #333; margin: 6px 0;">
            ${itemsToReturn
              .map(
                (i) => `
              <tr>
                <td style="padding: 4px 0;">${i.variantDescriptionCache || i.variantId}<br/><span style="color: #666;">${i.quantity} x ${formatCurrency(i.unitPriceRefunded)} (${i.condition})</span></td>
                <td style="text-align: right; font-weight: bold;">${formatCurrency(i.quantity * i.unitPriceRefunded)}</td>
              </tr>
            `
              )
              .join("")}
          </table>
          <div style="font-size: 12px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal Returned:</span>
              <span>${formatCurrency(returnDoc.subtotalRefund)}</span>
            </div>
            ${
              mode === "EXCHANGE" && replacementVariant
                ? `<div style="display: flex; justify-content: space-between; font-weight: bold; color: #1d4ed8;">
                    <span>Exchange Replacement:</span>
                    <span>${replacementVariant.productNameCache} (${replacementVariant.sizeLabelCache})</span>
                  </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-top: 4px;">
              <span>Net Refund / Settlement:</span>
              <span>${formatCurrency(returnDoc.netRefundAmount)} (${returnDoc.refundMethod})</span>
            </div>
          </div>
          <div style="text-align: center; font-size: 10px; color: #666; margin-top: 12px;">
            * Original sale adjusted * Thank you *
          </div>
        </div>
      `;

      openPrintModal(`Return Slip — ${returnDoc.returnNumber}`, returnVoucherHTML);
      setLoadedSale(null);
      setLoadedItems([]);
      setSearchInvoiceNumber("");
    } catch (err: any) {
      showToast(err.message || "Failed to process return", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
          Returns & Exchanges
        </h2>
        <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
          Verify original receipts, restock sellable footwear, route defects, and process size swaps.
        </div>
      </div>

      {/* SEARCH / RECEIPT LOOKUP BAR */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          padding: "16px 20px",
        }}
      >
        <form onSubmit={handleLookup} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "0 0 380px" }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Enter original invoice (e.g. SHOP001-INV-000101)…"
              value={searchInvoiceNumber}
              onChange={(e) => setSearchInvoiceNumber(e.target.value)}
              style={{ paddingLeft: "36px", height: "44px", fontSize: "14px", fontVariantNumeric: "tabular-nums", fontWeight: "600" }}
            />
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: "44px" }}>
            <Search size={15} /> Find original sale
          </button>
        </form>
      </div>

      {/* LOADED SALE DETAILS */}
      {loadedSale && (
        <div
          className="animate-fade-in"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "24px",
          }}
        >
          {/* Invoice Summary Banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--line)",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Receipt size={20} style={{ color: "var(--primary)" }} />
                <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{loadedSale.invoiceNumber}</h3>
                <span className="badge badge-neutral">Sale date: {formatDate(loadedSale.createdAt)}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "4px" }}>
                Customer: <strong style={{ color: "var(--ink)" }}>{loadedSale.customerName || "Walk-in guest"}</strong> · Original total:{" "}
                <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(loadedSale.total)}</strong>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="seg-control" style={{ width: "320px" }}>
              <button
                type="button"
                className={mode === "REFUND" ? "active" : ""}
                onClick={() => setMode("REFUND")}
              >
                Direct refund
              </button>
              <button
                type="button"
                className={mode === "EXCHANGE" ? "active" : ""}
                onClick={() => setMode("EXCHANGE")}
              >
                Size / variant exchange
              </button>
            </div>
          </div>

          {/* Items Return Selection Table */}
          <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink)", marginBottom: "12px" }}>
            Select items to return or exchange:
          </h4>
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>Select</th>
                  <th>Item / model</th>
                  <th>Sold qty</th>
                  <th>Prev returned</th>
                  <th>Return qty</th>
                  <th className="num">Price paid</th>
                  <th>Condition (routing)</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {loadedItems.map((it) => {
                  const conf = returnConfig[it.id] || { selected: false, quantity: 1, condition: "NEW_RESELLABLE", reason: "SIZE_FIT" };
                  const maxReturnable = it.quantity - it.returnedQuantity;
                  const isEligible = maxReturnable > 0;

                  return (
                    <tr key={it.id} style={{ opacity: isEligible ? 1 : 0.5 }}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!isEligible}
                          checked={conf.selected}
                          onChange={(e) => {
                            setReturnConfig((prev) => ({
                              ...prev,
                              [it.id]: { ...conf, selected: e.target.checked },
                            }));
                          }}
                          style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary)" }}
                        />
                      </td>
                      <td style={{ fontWeight: "600", color: "var(--ink)" }}>{it.variantDescriptionCache}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{it.quantity}</td>
                      <td style={{ color: it.returnedQuantity > 0 ? "var(--danger)" : "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {it.returnedQuantity}
                      </td>
                      <td>
                        <input
                          type="number"
                          disabled={!conf.selected || !isEligible}
                          min="1"
                          max={maxReturnable}
                          value={conf.quantity}
                          onChange={(e) => {
                            const val = Math.min(maxReturnable, Math.max(1, parseInt(e.target.value) || 1));
                            setReturnConfig((prev) => ({
                              ...prev,
                              [it.id]: { ...conf, quantity: val },
                            }));
                          }}
                          style={{
                            width: "60px",
                            height: "36px",
                            background: "var(--surface)",
                            border: "1px solid var(--line-strong)",
                            borderRadius: "var(--radius-control)",
                            color: "var(--ink)",
                            textAlign: "center",
                            padding: "4px",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        />
                      </td>
                      <td className="num" style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(it.unitSellingPrice)}</td>
                      <td>
                        <select
                          disabled={!conf.selected}
                          value={conf.condition}
                          onChange={(e) => {
                            setReturnConfig((prev) => ({
                              ...prev,
                              [it.id]: { ...conf, condition: e.target.value as any },
                            }));
                          }}
                          style={{
                            height: "36px",
                            background: "var(--surface)",
                            border: "1px solid var(--line-strong)",
                            color: "var(--ink)",
                            borderRadius: "var(--radius-control)",
                            padding: "0 8px",
                            fontSize: "13px",
                            fontFamily: "inherit",
                          }}
                        >
                          <option value="NEW_RESELLABLE">Sellable (Restock to branch)</option>
                          <option value="DEFECTIVE">Defective / damaged (Route to defect log)</option>
                        </select>
                      </td>
                      <td>
                        <select
                          disabled={!conf.selected}
                          value={conf.reason}
                          onChange={(e) => {
                            setReturnConfig((prev) => ({
                              ...prev,
                              [it.id]: { ...conf, reason: e.target.value as any },
                            }));
                          }}
                          style={{
                            height: "36px",
                            background: "var(--surface)",
                            border: "1px solid var(--line-strong)",
                            color: "var(--ink)",
                            borderRadius: "var(--radius-control)",
                            padding: "0 8px",
                            fontSize: "13px",
                            fontFamily: "inherit",
                          }}
                        >
                          <option value="SIZE_FIT">Size / fit issue</option>
                          <option value="DEFECT">Manufacturing defect</option>
                          <option value="CUSTOMER_CHOICE">Customer preference change</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* IF SIZE EXCHANGE: REPLACEMENT VARIANT SELECTOR */}
          {mode === "EXCHANGE" && (
            <div
              style={{
                padding: "16px 20px",
                marginBottom: "20px",
                background: "var(--primary-soft)",
                border: "1px solid var(--primary-soft-line)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <ArrowLeftRight size={18} style={{ color: "var(--primary)" }} />
                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--primary-ink)" }}>
                  Select replacement shoe variant (Size / style swap):
                </h4>
              </div>

              <select
                className="input-field"
                value={selectedReplacementVariantId}
                onChange={(e) => setSelectedReplacementVariantId(e.target.value)}
                style={{ fontSize: "14px", marginBottom: "10px", background: "var(--surface)" }}
              >
                <option value="">-- Choose replacement shoe variant --</option>
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productNameCache} — {v.colorNameCache} — Size: {v.sizeLabelCache} ({formatCurrency(v.sellingPrice)}) [SKU: {v.sku}]
                  </option>
                ))}
              </select>

              {replacementVariant && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-control)",
                    fontSize: "14px",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div>
                    Replacement: <strong style={{ color: "var(--ink)" }}>{replacementVariant.productNameCache}</strong> ({replacementVariant.sizeLabelCache})
                  </div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>
                    Price: <strong style={{ color: "var(--ink)" }}>{formatCurrency(replacementVariant.sellingPrice)}</strong>
                  </div>
                  <div>
                    Balance difference:{" "}
                    <strong style={{ color: exchangeDelta > 0 ? "var(--danger)" : "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                      {exchangeDelta > 0
                        ? `Customer pays +${formatCurrency(exchangeDelta)}`
                        : exchangeDelta < 0
                        ? `Refund customer ${formatCurrency(Math.abs(exchangeDelta))}`
                        : "Even swap (Rs. 0.00)"}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REFUND METHOD (If refund) */}
          {mode === "REFUND" && (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                Settlement refund method
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["CASH", "ORIGINAL_CARD", "STORE_CREDIT"] as RefundMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-sm ${refundMethod === m ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setRefundMethod(m)}
                  >
                    {m === "CASH" ? "Cash (Drawer payout)" : m === "ORIGINAL_CARD" ? "Card reversal" : "Store credit"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* NOTES & SUBMISSION */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 380px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Return notes (optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Optional notes or manager approval…"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
              />
            </div>

            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ fontSize: "14px", color: "var(--ink-2)" }}>
                Total return value: <strong style={{ color: "var(--ink)", fontSize: "18px", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(grossRefundTotal)}</strong>
              </div>
              <button
                className="btn btn-primary btn-lg"
                disabled={grossRefundTotal <= 0 || isSubmitting}
                onClick={handleSubmitReturn}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Processing…" : mode === "EXCHANGE" ? "Complete exchange swap" : "Authorize & settle refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
