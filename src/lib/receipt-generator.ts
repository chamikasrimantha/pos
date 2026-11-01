// src/lib/receipt-generator.ts
// Pixel-accurate, vector thermal slip and barcode label generator
import {
  Sale,
  SaleItem,
  DailyCashSummary,
  ShoeRepairOrder,
  StockTransfer,
  Shop,
  ProductVariant,
  Customer,
  CustomerPaymentReceipt,
  CashAdvanceReceipt,
  CustomerLedgerEntry,
  Purchase,
  Cheque,
  Supplier,
} from "@/types";
import { generateBarcodeSVG } from "./barcode-svg";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("LKR", "Rs.");
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── 1. SALES INVOICE (80mm Thermal Receipt) ──────────────────────────────────
export function renderSaleReceiptHTML(
  sale: Sale,
  items: SaleItem[],
  shop: Shop,
  isDuplicate: boolean = false
): string {
  const itemRows = items
    .map(
      (it) => `
    <tr>
      <td style="padding: 5px 0; font-size: 13px; vertical-align: top;">
        <div style="font-weight: 700; color: #000;">${it.variantDescriptionCache}</div>
        <div style="font-size: 11px; color: #333;">
          ${it.quantity} x ${formatCurrency(it.unitSellingPrice)}
          ${it.discount > 0 ? ` <span style="color:#b91c1c;">(-${formatCurrency(it.discount)})</span>` : ""}
        </div>
      </td>
      <td style="text-align: right; vertical-align: top; padding: 5px 0; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;">
        ${formatCurrency(it.lineTotal)}
      </td>
    </tr>
  `
    )
    .join("");

  const payments = sale.payments
    .map(
      (p) => `
    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 3px;">
      <span>Paid (${p.method}):</span>
      <span style="font-variant-numeric: tabular-nums; font-weight: 600;">${formatCurrency(p.amount)}</span>
    </div>
  `
    )
    .join("");

  const invoiceBarcodeSVG = generateBarcodeSVG(sale.invoiceNumber, {
    format: "CODE128",
    height: 32,
    width: 1.8,
    displayValue: true,
    fontSize: 10,
    margin: 4,
  });

  const isCredit = sale.paymentStatus === "CREDIT" || (sale.balanceDue !== undefined && sale.balanceDue > 0);

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
      ${
        isDuplicate
          ? `<div style="text-align: center; font-weight: 900; font-size: 13px; border: 2px dashed #000; padding: 4px; margin-bottom: 8px; letter-spacing: 1px;">
              *** DUPLICATE INVOICE ***
            </div>`
          : ""
      }
      ${
        isCredit
          ? `<div style="text-align: center; font-weight: 900; font-size: 14px; border: 2px solid #000; padding: 4px; margin-bottom: 8px; letter-spacing: 1px;">
              *** CREDIT SALE ***
            </div>`
          : ""
      }
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
          ${shop.name}
        </h2>
        <div style="font-size: 11px; margin-top: 3px; font-weight: 600;">${shop.address}</div>
        <div style="font-size: 11px;">Tel: ${shop.phone} ${shop.taxNumber ? `| ${shop.taxNumber}` : ""}</div>
      </div>

      <!-- Sale Meta -->
      <div style="font-size: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Invoice:</strong> ${sale.invoiceNumber}</span>
          <span><strong>Branch:</strong> ${shop.code}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Date: ${formatDate(sale.createdAt)}</span>
        </div>
        <div>Cashier: ${sale.cashierNameCache}</div>
        ${sale.customerName ? `<div>Customer: ${sale.customerName} (${sale.customerPhone || "-"})</div>` : ""}
        ${isCredit && sale.paymentStatus ? `<div>Payment Status: <strong>${sale.paymentStatus}</strong></div>` : ""}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 8px 0; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #000; font-size: 11px; text-align: left; text-transform: uppercase;">
            <th style="padding: 4px 0;">Item Description</th>
            <th style="text-align: right; padding: 4px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals & Payments -->
      <div style="margin-top: 6px; border-bottom: 1px dashed #000; padding-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span>Subtotal:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(sale.subtotal)}</span>
        </div>
        ${
          sale.discount > 0
            ? `<div style="display: flex; justify-content: space-between; font-size: 12px; color: #000;">
                <span>Total Discount:</span>
                <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(sale.discount)}</span>
              </div>`
            : ""
        }
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 4px;">
          <span>NET TOTAL:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(sale.total)}</span>
        </div>
        <div style="margin-top: 6px;">
          ${payments}
        </div>
        ${
          isCredit
            ? `<div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-top: 4px; color: #b91c1c; border-top: 1px dashed #000; padding-top: 4px;">
                <span>Balance Due:</span>
                <span style="font-variant-numeric: tabular-nums;">${formatCurrency(sale.balanceDue || 0)}</span>
              </div>`
            : ""
        }
        ${
          sale.changeGiven && sale.changeGiven > 0
            ? `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
                <span>Change Given:</span>
                <span style="font-variant-numeric: tabular-nums; font-weight: 700;">${formatCurrency(sale.changeGiven)}</span>
              </div>`
            : ""
        }
      </div>

      <!-- Barcode for Return Scans -->
      <div style="text-align: center; margin-top: 10px;">
        ${invoiceBarcodeSVG}
      </div>

      <!-- Customer Signature line for Credit Sales (Section 5.7) -->
      ${
        isCredit
          ? `<div style="margin-top: 26px; padding-top: 6px; border-top: 1px dashed #000; font-size: 11px;">
              Customer Signature: _______________________
            </div>`
          : ""
      }

      <!-- Footer Policy -->
      <div style="text-align: center; margin-top: 8px; font-size: 11px; white-space: pre-line; color: #222;">
        ${shop.receiptFooter || "Thank you for shopping with us!"}
      </div>

      <div style="text-align: center; margin-top: 8px; font-size: 10px; color: #444;">
        * * * System Generated Official Invoice * * *
      </div>
    </div>
  `;
}

// ── 2. DAILY CASH SUMMARY SLIP & REPORT (80mm Thermal & A4 Formats) ────────
export function renderDailyCashSummaryHTML(
  summary: DailyCashSummary,
  shopName: string,
  mode: "THERMAL_80MM" | "A4" = "THERMAL_80MM"
): string {
  if (mode === "A4") {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 15mm; color: #111; background: #fff;">
        <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0 0 4px; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px;">APEX POS - DAILY CASH SUMMARY</h2>
            <div style="font-size: 13px; font-weight: bold;">OUTLET: ${shopName.toUpperCase()} &nbsp;|&nbsp; DATE: ${summary.periodLabel || summary.dateKey}</div>
            <div style="font-size: 11px; color: #555; margin-top: 2px;">
              ${summary.cashierName ? `Cashier: <strong>${summary.cashierName}</strong> &nbsp;|&nbsp; ` : ""}Printed at: ${formatDate(Date.now())}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #555;">NET CASH MOVEMENT</div>
            <div style="font-size: 20px; font-weight: 900; color: ${summary.netCashMovement >= 0 ? '#166534' : '#b91c1c'}; font-variant-numeric: tabular-nums;">
              ${formatCurrency(summary.netCashMovement)}
            </div>
          </div>
        </div>

        <!-- Inflow & Outflow Cards -->
        <div style="display: flex; gap: 16px; margin-bottom: 20px;">
          <!-- Cash Inflow -->
          <div style="flex: 1; border: 1px solid #166534; border-radius: 6px; overflow: hidden;">
            <div style="background: #f0fdf4; padding: 8px 12px; font-size: 12px; font-weight: bold; color: #166534; border-bottom: 1px solid #166534; display: flex; justify-content: space-between;">
              <span>TOTAL CASH INFLOW</span>
              <span>+${formatCurrency(summary.totalCashIn)}</span>
            </div>
            <div style="padding: 12px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Gross Cash Sales (${summary.salesCount} sales)</span>
                <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(summary.cashSales)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Repair Cash Collected (${summary.repairsCount} jobs)</span>
                <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(summary.repairCashCollected)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Customer Payments on Account</span>
                <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(summary.cashReceivedOnAccount || 0)}</strong>
              </div>
            </div>
          </div>

          <!-- Cash Outflow -->
          <div style="flex: 1; border: 1px solid #b91c1c; border-radius: 6px; overflow: hidden;">
            <div style="background: #fef2f2; padding: 8px 12px; font-size: 12px; font-weight: bold; color: #b91c1c; border-bottom: 1px solid #b91c1c; display: flex; justify-content: space-between;">
              <span>TOTAL CASH OUTFLOW</span>
              <span>-${formatCurrency(summary.totalCashOut)}</span>
            </div>
            <div style="padding: 12px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Customer Cash Refunds (${summary.refundsCount} returns)</span>
                <strong style="font-variant-numeric: tabular-nums; color: #b91c1c;">-${formatCurrency(summary.cashRefunds)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Cash Paid for Purchases (${summary.purchasesCount || 0} bills)</span>
                <strong style="font-variant-numeric: tabular-nums; color: #b91c1c;">-${formatCurrency(summary.cashPaidForPurchases || 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Cash Advances Given</span>
                <strong style="font-variant-numeric: tabular-nums; color: #b91c1c;">-${formatCurrency(summary.cashAdvancesGiven || 0)}</strong>
              </div>
            </div>
          </div>
        </div>

        ${summary.cashierBreakdowns && summary.cashierBreakdowns.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase;">Cashier Breakdown</h4>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc; font-size: 12px;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase;">
                  <th style="padding: 8px; text-align: left;">Cashier</th>
                  <th style="padding: 8px; text-align: right;">Cash Sales</th>
                  <th style="padding: 8px; text-align: right;">Repair Cash</th>
                  <th style="padding: 8px; text-align: right;">Cash Refunds</th>
                  <th style="padding: 8px; text-align: right;">Net Movement</th>
                </tr>
              </thead>
              <tbody>
                ${summary.cashierBreakdowns.map((cb) => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; font-weight: bold;">${cb.cashierName || cb.cashierId || "Cashier"}</td>
                    <td style="padding: 8px; text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(cb.cashSales)}</td>
                    <td style="padding: 8px; text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(cb.repairCashCollected)}</td>
                    <td style="padding: 8px; text-align: right; font-variant-numeric: tabular-nums; color: ${cb.cashRefunds > 0 ? '#b91c1c' : 'inherit'};">-${formatCurrency(cb.cashRefunds)}</td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; color: ${cb.netCashMovement >= 0 ? '#166534' : '#b91c1c'};">${formatCurrency(cb.netCashMovement)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 11px;">
          <div style="text-align: center; width: 200px;">
            <div style="border-bottom: 1px solid #000; height: 35px;"></div>
            <div style="margin-top: 4px; font-weight: bold;">Cashier Signature</div>
          </div>
          <div style="text-align: center; width: 200px;">
            <div style="border-bottom: 1px solid #000; height: 35px;"></div>
            <div style="margin-top: 4px; font-weight: bold;">Authorized Manager</div>
          </div>
        </div>
      </div>
    `;
  }

  // 80mm Thermal Slip format
  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 14px 8px; color: #000; line-height: 1.35; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 900;">DAILY CASH SUMMARY</h2>
        <div style="font-size: 13px; font-weight: bold; margin-top: 3px;">${shopName}</div>
        <div style="font-size: 11px; margin-top: 2px;">Date: ${summary.periodLabel || summary.dateKey}</div>
      </div>

      <div style="font-size: 12px; margin-bottom: 8px;">
        ${summary.cashierName ? `<div><strong>Cashier:</strong> ${summary.cashierName}</div>` : ""}
        <div><strong>Generated:</strong> ${formatDate(Date.now())}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 4px; font-size: 11px;">CASH INFLOW:</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Cash Sales (${summary.salesCount}):</span>
          <span style="font-variant-numeric: tabular-nums;">+${formatCurrency(summary.cashSales)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Repair Cash (${summary.repairsCount}):</span>
          <span style="font-variant-numeric: tabular-nums;">+${formatCurrency(summary.repairCashCollected)}</span>
        </div>
        ${summary.cashReceivedOnAccount ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Account Payments:</span>
          <span style="font-variant-numeric: tabular-nums;">+${formatCurrency(summary.cashReceivedOnAccount)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dotted #ccc; padding-top: 2px; margin-top: 2px;">
          <span>Total Cash In:</span>
          <span style="font-variant-numeric: tabular-nums;">+${formatCurrency(summary.totalCashIn)}</span>
        </div>

        <div style="font-weight: bold; margin-top: 8px; margin-bottom: 4px; font-size: 11px;">CASH OUTFLOW:</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Cash Refunds (${summary.refundsCount}):</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(summary.cashRefunds)}</span>
        </div>
        ${summary.cashPaidForPurchases ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Purchases Paid:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(summary.cashPaidForPurchases)}</span>
        </div>` : ""}
        ${summary.cashAdvancesGiven ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Advances Given:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(summary.cashAdvancesGiven)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dotted #ccc; padding-top: 2px; margin-top: 2px;">
          <span>Total Cash Out:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(summary.totalCashOut)}</span>
        </div>
      </div>

      <div style="margin: 10px 0; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
          <span>NET CASH MOVEMENT:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(summary.netCashMovement)}</span>
        </div>
      </div>

      ${summary.cashierBreakdowns && summary.cashierBreakdowns.length > 0 ? `
        <div style="font-size: 11px; margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Cashier Breakdown:</div>
          ${summary.cashierBreakdowns.map((cb) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>${cb.cashierName || "Cashier"}:</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: bold;">${formatCurrency(cb.netCashMovement)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <div style="text-align: center; font-size: 10px; color: #555; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px;">
        * * * Official Daily Cash Record * * *
      </div>
    </div>
  `;
}

// ── 3. REPAIR INTAKE CLAIM SLIP & ATTACHMENT TAG (SHOES & BAGS) ───────────
export function renderRepairIntakeSlipHTML(
  repair: ShoeRepairOrder,
  shop: Shop
): string {
  // Use short code for tag barcode so it stays inside label bounds
  const shortCode = repair.repairNumber.split("-").pop() || repair.repairNumber;
  const tagBarcode = generateBarcodeSVG(shortCode, {
    format: "CODE128",
    height: 30,
    width: 1.4,
    displayValue: true,
    fontSize: 10,
    margin: 2,
  });

  const fullBarcode = generateBarcodeSVG(repair.repairNumber, {
    format: "CODE128",
    height: 36,
    width: 1.8,
    displayValue: true,
    fontSize: 11,
    margin: 4,
  });

  const isBag = repair.itemType === "BAG";
  const itemTypeLabel = isBag ? "Bag" : "Footwear";
  const subTypeLabel = repair.subType || (isBag ? "Bag" : "Shoe");
  const brand = repair.brand || repair.shoeBrand || "Generic";
  const model = repair.model || repair.shoeModel || "";
  const size = repair.size || repair.shoeSize || "";
  const color = repair.color || repair.shoeColor || "";
  const dimension = repair.dimension;

  const itemSpecs = [
    color,
    size ? (isBag ? `Size: ${size}` : `Size ${size}`) : "",
    dimension ? `Dim: ${dimension}` : "",
  ].filter(Boolean).join(", ");

  const isWarranty = !!repair.isWarranty;
  const hasEstimate = isWarranty ? false : repair.hasEstimate !== false;

  return `
    <div style="font-family: Arial, sans-serif; width: 300px; margin: 0 auto; padding: 10px; color: #000; line-height: 1.35; background: #fff;">
      <!-- PART 1: CUSTOMER CLAIM SLIP -->
      <div style="border: 2px solid #000; padding: 10px; margin-bottom: 14px;">
        <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase;">REPAIR INTAKE CLAIM SLIP</h3>
          <div style="font-size: 12px; font-weight: bold;">${shop.name}</div>
          <div style="font-size: 11px;">Tel: ${shop.phone}</div>
        </div>

        <div style="text-align: center; margin-bottom: 6px; max-width: 100%; overflow: hidden;">
          ${fullBarcode}
        </div>

        <div style="font-size: 12px; margin-bottom: 6px;">
          <div><strong>Customer:</strong> ${repair.customerName}</div>
          <div><strong>Contact:</strong> ${repair.customerPhone}</div>
          <div><strong>Intake Date:</strong> ${formatDate(repair.receivedAt)}</div>
          <div style="color: #b91c1c; font-weight: 700;"><strong>Promised Date:</strong> ${formatDate(repair.promisedDate)}</div>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 12px; margin: 6px 0;">
          <div><strong>Item (${itemTypeLabel} - ${subTypeLabel}):</strong> ${brand} ${model} (${itemSpecs})</div>
          <div><strong>Origin:</strong> ${repair.isStorePurchased ? "Store Purchase" : "External Item"}</div>
          <div style="margin-top: 4px;"><strong>Diagnosis / Task:</strong><br/><span style="color: #222;">${repair.issueDescription}</span></div>
        </div>

        ${isWarranty ? `
        <div style="background: #f0fdf4; border: 1px solid #16a34a; padding: 6px; border-radius: 4px; margin: 6px 0; text-align: center;">
          <strong style="color: #15803d; font-size: 13px;">WARRANTY CLAIM — NO CHARGE</strong>
          <div style="font-size: 11px; margin-top: 2px;">
            Basis: ${repair.warrantyBasis === "STORE_INVOICE" ? `Store Invoice #${repair.warrantyInvoiceNumber || "N/A"}` : `Manual Card #${repair.warrantyCardNumber || "N/A"}`}
            (${repair.warrantyStatus || "UNVERIFIED"})
          </div>
          ${repair.warrantyCoverageNote ? `<div style="font-size: 10px; color: #555; margin-top: 2px;">${repair.warrantyCoverageNote}</div>` : ""}
        </div>
        ` : !hasEstimate ? `
        <div style="font-size: 12px; margin: 6px 0; text-align: center; background: #f3f4f6; padding: 8px; border-radius: 4px; border: 1px dashed #6b7280;">
          <strong>Billing Estimate:</strong>
          <div style="font-size: 13px; font-weight: bold; color: #374151; margin-top: 2px;">Estimate to be advised</div>
          <div style="font-size: 10px; color: #6b7280;">Final cost will be confirmed upon completion / delivery</div>
        </div>
        ` : `
        <div style="font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Estimated Fee:</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(repair.estimatedCost)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>Advance Deposit Paid:</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(repair.advancePaid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; margin-top: 3px; padding-top: 3px;">
            <span>ESTIMATED BALANCE:</span>
            <span style="font-variant-numeric: tabular-nums;">${formatCurrency(repair.balanceDue)}</span>
          </div>
        </div>
        `}

        <div style="font-size: 10px; color: #444; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; text-align: center;">
          * Present this slip for item collection.<br/>
          * Items not collected within 30 days are subject to disposal.
        </div>
      </div>

      <!-- PART 2: PHYSICAL WORKSHOP ATTACHMENT TAG -->
      <div style="border: 2px dashed #000; padding: 8px; background: #fffbe8; max-width: 280px; box-sizing: border-box; overflow: hidden;">
        <div style="text-align: center; font-size: 11px; font-weight: 900;">[ WORKSHOP ${isBag ? "BAG" : "SHOE"} ATTACHMENT TAG ]</div>
        <div style="text-align: center; margin: 4px 0; max-width: 100%; overflow: hidden;">
          ${tagBarcode}
        </div>
        <div style="font-size: 11px; word-break: break-word;">
          <div><strong>Ticket:</strong> ${repair.repairNumber}</div>
          <div><strong>Cust:</strong> ${repair.customerName} (${repair.customerPhone})</div>
          <div><strong>Item:</strong> ${subTypeLabel} | ${brand} | ${color}${size ? ` | Sz: ${size}` : ""}</div>
          ${isWarranty ? `<div style="font-weight: 700; color: #15803d;">** WARRANTY CLAIM — NO CHARGE **</div>` : ""}
          ${!isWarranty && !hasEstimate ? `<div><strong>Estimate:</strong> Estimate to be advised</div>` : ""}
          <div><strong>Promised:</strong> ${new Date(repair.promisedDate).toLocaleDateString("en-LK")}</div>
          <div style="margin-top: 2px; font-weight: 700;">Tasks: ${repair.issueDescription}</div>
        </div>
      </div>
    </div>
  `;
}

// ── 4. REPAIR DELIVERY SERVICE INVOICE ───────────────────────────────────────
export function renderRepairDeliveryReceiptHTML(
  repair: ShoeRepairOrder,
  shop: Shop
): string {
  const isBag = repair.itemType === "BAG";
  const itemTypeLabel = isBag ? "Bag" : "Footwear";
  const subTypeLabel = repair.subType || (isBag ? "Bag" : "Shoe");
  const brand = repair.brand || repair.shoeBrand || "Generic";
  const model = repair.model || repair.shoeModel || "";
  const size = repair.size || repair.shoeSize || "";
  const color = repair.color || repair.shoeColor || "";
  const dimension = repair.dimension;

  const itemSpecs = [
    color,
    size ? (isBag ? `Size: ${size}` : `Size ${size}`) : "",
    dimension ? `Dim: ${dimension}` : "",
  ].filter(Boolean).join(", ");

  const isWarranty = !!repair.isWarranty;
  const finalPay = isWarranty ? 0 : Math.max(0, (repair.finalCost || repair.estimatedCost) - repair.advancePaid);

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">REPAIR SERVICE INVOICE</h2>
        <div style="font-size: 13px; font-weight: bold; margin-top: 3px;">${shop.name}</div>
        <div style="font-size: 11px;">Tel: ${shop.phone}</div>
      </div>

      <div style="font-size: 12px; margin-bottom: 8px;">
        <div><strong>Job Number:</strong> ${repair.repairNumber}</div>
        <div><strong>Delivered Date:</strong> ${formatDate(repair.deliveredAt || Date.now())}</div>
        <div><strong>Customer:</strong> ${repair.customerName} (${repair.customerPhone})</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 12px;">
        <div><strong>${itemTypeLabel} Article:</strong> ${brand} ${model} (${itemSpecs})</div>
        <div><strong>Type:</strong> ${subTypeLabel}</div>
        <div style="margin-top: 4px;"><strong>Service Rendered:</strong> ${repair.issueDescription}</div>
      </div>

      ${isWarranty ? `
      <div style="margin-top: 10px; padding: 8px; border: 1px dashed #000; text-align: center; font-size: 13px; font-weight: bold;">
        <div>Warranty service — no charge</div>
        <div style="font-size: 11px; font-weight: normal; margin-top: 2px;">
          Basis: ${repair.warrantyBasis === "STORE_INVOICE" ? `Store Invoice #${repair.warrantyInvoiceNumber || ""}` : `Manual Card #${repair.warrantyCardNumber || ""}`}
          (${repair.warrantyStatus || "VERIFIED"})
        </div>
      </div>
      ` : `
      <div style="margin-top: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Total Service Charge:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(repair.finalCost || repair.estimatedCost)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Less Advance Paid:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(repair.advancePaid)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 15px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
          <span>BALANCE COLLECTED:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(finalPay)}</span>
        </div>
        <div style="font-size: 11px; margin-top: 4px;">
          Payment Method: ${repair.deliveryPaymentMethod || "CASH"}
        </div>
      </div>
      `}

      <div style="text-align: center; margin-top: 14px; font-size: 11px; border-top: 1px dashed #000; padding-top: 8px;">
        Goods collected in satisfactory condition.<br/>
        Workshop stitching & sole bond warranty: 14 days<br/>
        (Repair workmanship warranty).
      </div>
    </div>
  `;
}

// ── 5. INTER-SHOP STOCK TRANSFER DISPATCH NOTE ──────────────────────────────
export function renderTransferDispatchNoteHTML(
  transfer: StockTransfer,
  sourceShop: Shop,
  destShop: Shop
): string {
  const isQuick = transfer.mode === "QUICK";
  const itemRows = transfer.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #000; font-size: 12px;">
      <td style="padding: 6px 4px; text-align: center;">${idx + 1}</td>
      <td style="padding: 6px 4px; font-weight: 700;">${it.variantDescriptionCache}</td>
      <td style="padding: 6px 4px; text-align: center; font-weight: 900;">${it.dispatchedQuantity}</td>
      <td style="padding: 6px 4px; text-align: center; font-weight: ${isQuick ? "900" : "normal"};">${
        it.receivedQuantity > 0 ? it.receivedQuantity : isQuick ? it.dispatchedQuantity : "[ &nbsp; ]"
      }</td>
    </tr>
  `
    )
    .join("");

  const transferBarcode = generateBarcodeSVG(transfer.transferNumber, {
    format: "CODE128",
    height: 34,
    width: 2,
    displayValue: true,
    fontSize: 11,
  });

  return `
    <div style="font-family: Arial, sans-serif; width: 440px; margin: 0 auto; padding: 18px; color: #000; line-height: 1.4; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">
          ${isQuick ? "COMPLETED STOCK TRANSFER NOTE" : "INTER-SHOP STOCK TRANSFER NOTE"}
        </h2>
        ${isQuick ? `<div style="font-size: 11px; font-weight: 700; color: #10b981; margin-top: 2px;">COMPLETED TRANSFER (IMMEDIATE RECEIPT)</div>` : ""}
        <div style="text-align: center; margin: 6px 0;">${transferBarcode}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 14px; background: #f3f4f6; padding: 10px; border: 1px solid #000;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #555;">DISPATCH ORIGIN</div>
          <div style="font-weight: 900; font-size: 13px;">${sourceShop.name} (${sourceShop.code})</div>
          <div>${sourceShop.phone}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #555;">RECEIVING DESTINATION</div>
          <div style="font-weight: 900; font-size: 13px;">${destShop.name} (${destShop.code})</div>
          <div>${destShop.phone}</div>
        </div>
      </div>

      <div style="font-size: 12px; margin-bottom: 10px; display: flex; justify-content: space-between;">
        <span><strong>${isQuick ? "Transfer Date:" : "Dispatched Date:"}</strong> ${formatDate(transfer.dispatchedAt)}</span>
        <span><strong>Status:</strong> ${transfer.status}</span>
      </div>

      ${transfer.notes ? `<div style="font-size: 12px; margin-bottom: 10px; padding: 6px 8px; background: #fef3c7; border: 1px solid #f59e0b;"><strong>Note:</strong> ${transfer.notes}</div>` : ""}

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #000;">
        <thead>
          <tr style="background: #000; color: #fff; font-size: 11px; text-align: left;">
            <th style="padding: 6px 4px; width: 24px; text-align: center;">#</th>
            <th style="padding: 6px 4px;">Item Variant</th>
            <th style="padding: 6px 4px; text-align: center; width: 70px;">Dispatched</th>
            <th style="padding: 6px 4px; text-align: center; width: 70px;">Received</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr style="font-weight: 900; font-size: 13px; border-top: 2px solid #000; background: #f9fafb;">
            <td colspan="2" style="padding: 8px 4px;">TOTAL PAIRS / UNITS:</td>
            <td style="padding: 8px 4px; text-align: center;">${transfer.totalQuantity}</td>
            <td style="padding: 8px 4px; text-align: center;">${isQuick ? transfer.totalQuantity : "-"}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 26px; font-size: 11px; display: flex; justify-content: space-between;">
        <div>
          __________________________<br/>
          <strong>Dispatched By (Origin)</strong><br/>
          <span>${transfer.dispatchedBy}</span>
        </div>
        <div>
          __________________________<br/>
          <strong>Received By (Destination)</strong><br/>
          <span>${transfer.receivedBy || (isQuick ? transfer.dispatchedBy : "Pending Reception")}</span>
        </div>
      </div>
    </div>
  `;
}

export const renderTransferNoteHTML = renderTransferDispatchNoteHTML;

// ── 6. THERMAL BARCODE LABELS (50x30mm, 50x25mm, 40x30mm & A4 Sheet) ───────
export type BarcodeLabelSize = "50x30mm" | "50x25mm" | "40x30mm";

export function renderSingleThermalBarcodeLabel(
  variant: ProductVariant,
  outletName: string = "APEX FOOTWEAR",
  format: BarcodeLabelSize = "50x30mm"
): string {
  let widthMm = "50mm";
  let heightMm = "30mm";
  let barcodeHeight = 24;
  let barcodeWidth = 1.4;
  let storeFontSize = "6.5pt";
  let brandFontSize = "7.5pt";
  let nameFontSize = "7pt";
  let attrFontSize = "6.5pt";
  let sizeBadgeFontSize = "7.5pt";
  let priceFontSize = "9pt";
  let padding = "1.6mm 2mm";

  if (format === "50x25mm") {
    widthMm = "50mm";
    heightMm = "25mm";
    barcodeHeight = 18;
    barcodeWidth = 1.35;
    storeFontSize = "5.5pt";
    brandFontSize = "6.5pt";
    nameFontSize = "6.5pt";
    attrFontSize = "6pt";
    sizeBadgeFontSize = "6.5pt";
    priceFontSize = "8pt";
    padding = "1.2mm 1.8mm";
  } else if (format === "40x30mm") {
    widthMm = "40mm";
    heightMm = "30mm";
    barcodeHeight = 22;
    barcodeWidth = 1.15;
    storeFontSize = "5.5pt";
    brandFontSize = "6.5pt";
    nameFontSize = "6.5pt";
    attrFontSize = "6pt";
    sizeBadgeFontSize = "6.5pt";
    priceFontSize = "8pt";
    padding = "1.4mm 1.6mm";
  }

  const barcodeSVG = generateBarcodeSVG(variant.barcode, {
    height: barcodeHeight,
    width: barcodeWidth,
    displayValue: false,
    margin: 0,
  });

  return `
    <div class="thermal-barcode-label-item" style="width: ${widthMm}; height: ${heightMm}; max-width: ${widthMm}; max-height: ${heightMm}; border: 1px solid #111; padding: ${padding}; box-sizing: border-box; background: #fff; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; margin: 0 auto; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <!-- Store Header & Brand -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; padding-bottom: 1px; line-height: 1;">
        <span style="font-size: ${storeFontSize}; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;">${outletName}</span>
        <span style="font-size: ${brandFontSize}; font-weight: 900; text-transform: uppercase; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 42%; text-align: right;">${variant.brandNameCache || "BRAND"}</span>
      </div>

      <!-- Product Name -->
      <div style="font-size: ${nameFontSize}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; color: #000; text-align: left; line-height: 1.1;">
        ${variant.productNameCache}
      </div>

      <!-- Attributes: Color & Size -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${attrFontSize}; margin-top: 1px; line-height: 1.1;">
        <span style="color: #222; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">
          COL: <strong>${variant.colorNameCache}</strong>
        </span>
        <span style="font-weight: 900; font-size: ${sizeBadgeFontSize}; background: #000; color: #fff; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">
          SIZE: ${variant.sizeLabelCache}
        </span>
      </div>

      <!-- Price -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1px; line-height: 1.1;">
        <span style="font-size: 5pt; font-weight: 700; color: #444; text-transform: uppercase;">MRP (INCL. TAXES)</span>
        <span style="font-size: ${priceFontSize}; font-weight: 900; color: #000; letter-spacing: -0.3px;">${formatCurrency(variant.sellingPrice)}</span>
      </div>

      <!-- Vector Barcode & Digits -->
      <div style="text-align: center; margin: 0 auto; width: 100%; line-height: 1;">
        <div style="display: flex; justify-content: center; align-items: center; max-height: ${barcodeHeight}px; width: 100%; overflow: hidden;">
          ${barcodeSVG}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 5.5pt; font-weight: 800; margin-top: 1px; color: #000;">
          <span>${variant.sku}</span>
          <span style="letter-spacing: 0.5px;">${variant.barcode}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderThermalBarcodeLabelHTML(
  variant: ProductVariant,
  copies: number = 1,
  outletName: string = "APEX FOOTWEAR",
  format: BarcodeLabelSize = "50x30mm"
): string {
  const singleLabel = renderSingleThermalBarcodeLabel(variant, outletName, format);
  return `
    <div class="thermal-barcode-label-container" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
      ${Array.from({ length: copies }).map(() => singleLabel).join("")}
    </div>
  `;
}

export function renderBatchThermalBarcodeLabelsHTML(
  items: { variant: ProductVariant; copies: number }[],
  outletName: string = "APEX FOOTWEAR",
  format: BarcodeLabelSize = "50x30mm"
): string {
  const labelHTMLs: string[] = [];
  items.forEach((item) => {
    const single = renderSingleThermalBarcodeLabel(item.variant, outletName, format);
    for (let i = 0; i < item.copies; i++) {
      labelHTMLs.push(single);
    }
  });

  return `
    <div class="thermal-barcode-label-container" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
      ${labelHTMLs.join("")}
    </div>
  `;
}

export function renderA4BarcodeSheetHTML(
  items: { variant: ProductVariant; copies: number }[],
  outletName: string = "APEX FOOTWEAR"
): string {
  const flattenedLabels: string[] = [];
  items.forEach((item) => {
    const single = renderSingleThermalBarcodeLabel(item.variant, outletName);
    for (let i = 0; i < item.copies; i++) {
      flattenedLabels.push(single);
    }
  });

  // Split into pages of 24 (3 columns x 8 rows)
  const pageSize = 24;
  const pages: string[][] = [];
  for (let i = 0; i < flattenedLabels.length; i += pageSize) {
    pages.push(flattenedLabels.slice(i, i + pageSize));
  }

  return `
    <div class="a4-label-sheet-wrapper" style="font-family: Arial, sans-serif;">
      ${pages
        .map(
          (pageLabels, idx) => `
        <div class="a4-label-sheet-page" style="width: 210mm; min-height: 297mm; padding: 8mm 6mm; box-sizing: border-box; page-break-after: ${
          idx === pages.length - 1 ? "auto" : "always"
        }; break-after: ${
            idx === pages.length - 1 ? "auto" : "page"
          }; background: #fff; margin: 0 auto;">
          <div style="font-size: 8pt; color: #666; text-align: right; margin-bottom: 4mm;">
            Page ${idx + 1} of ${pages.length} &bull; ${pageLabels.length} Labels &bull; ${outletName}
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; justify-items: center;">
            ${pageLabels.join("")}
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// ── 7. DAILY SALES REPORT (A4 / 80mm Audit Slip) ─────────────────────────────
export function renderDailySalesReportHTML(
  report: any,
  shopName: string,
  generatedBy: string
): string {
  const salesRows = (report.sales || [])
    .map(
      (s: any) => `
      <tr style="border-bottom: 1px solid #eee; font-size: 10px;">
        <td style="padding: 4px;">${s.invoiceNumber}</td>
        <td style="padding: 4px;">${formatDate(s.createdAt)}</td>
        <td style="padding: 4px;">${s.cashierNameCache || "Cashier"}</td>
        <td style="padding: 4px;">${s.customerName || "Walk-in"}</td>
        <td style="padding: 4px; text-align: center;">${s.status}</td>
        <td style="padding: 4px; text-align: right; font-weight: bold;">${formatCurrency(s.netTotal)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 15mm; color: #111; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">APEX FOOTWEAR - DAILY SALES AUDIT REPORT</h2>
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 2px;">OUTLET: ${shopName.toUpperCase()}</div>
        <div style="font-size: 12px; color: #444;">Date: <strong>${report.dateDisplay || report.dateKey}</strong> &nbsp;|&nbsp; Generated By: ${generatedBy} &nbsp;|&nbsp; Printed: ${formatDate(Date.now())}</div>
      </div>

      <!-- Financial Summary Cards -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #000;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 1px solid #000; font-size: 11px;">
            <th style="padding: 6px; text-align: left;">Gross Sales</th>
            <th style="padding: 6px; text-align: left;">Discounts</th>
            <th style="padding: 6px; text-align: left;">Refunds / Returns</th>
            <th style="padding: 6px; text-align: left;">Net Footwear Sales</th>
            <th style="padding: 6px; text-align: left;">Repairs Income</th>
            <th style="padding: 6px; text-align: right;">Total Takings</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-size: 13px; font-weight: bold;">
            <td style="padding: 8px 6px;">${formatCurrency(report.grossSales)}</td>
            <td style="padding: 8px 6px; color: #b91c1c;">-${formatCurrency((report.itemDiscounts || 0) + (report.billDiscounts || 0))}</td>
            <td style="padding: 8px 6px; color: #b91c1c;">-${formatCurrency(report.refunds)}</td>
            <td style="padding: 8px 6px; color: #1d4ed8;">${formatCurrency(report.netSales)}</td>
            <td style="padding: 8px 6px; color: #047857;">${formatCurrency(report.repairIncome || 0)}</td>
            <td style="padding: 8px 6px; text-align: right; font-size: 15px;">${formatCurrency(report.netSales + (report.repairIncome || 0))}</td>
          </tr>
        </tbody>
      </table>

      <!-- Tender Breakdown -->
      <div style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Payment Tender Breakdown</h4>
        <div style="display: flex; gap: 12px; font-size: 12px;">
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px;">
            <div>Cash Collected:</div>
            <div style="font-size: 14px; font-weight: bold;">${formatCurrency(report.payments?.cash || 0)}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px;">
            <div>Card (POS Terminal):</div>
            <div style="font-size: 14px; font-weight: bold;">${formatCurrency(report.payments?.card || 0)}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px;">
            <div>Bank Transfers:</div>
            <div style="font-size: 14px; font-weight: bold;">${formatCurrency(report.payments?.bankTransfer || 0)}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px;">
            <div>Invoices Issued:</div>
            <div style="font-size: 14px; font-weight: bold;">${report.invoiceCount} invoices</div>
          </div>
        </div>
      </div>

      <!-- Daily Cash Summary -->
      <div style="margin-bottom: 18px; border: 1px solid #ccc; border-radius: 4px; padding: 10px;">
        <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase;">Daily Cash Movement</h4>
        <div style="display: flex; gap: 12px; font-size: 12px;">
          <div style="flex: 1; border: 1px solid #166534; padding: 8px; border-radius: 4px; background: #f0fdf4;">
            <div style="color: #166534; font-size: 11px; font-weight: bold;">CASH INFLOW</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <span>Cash Sales:</span>
              <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(report.dailyCashSummary?.cashSales || report.payments?.cash || 0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Repair Cash:</span>
              <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(report.dailyCashSummary?.repairCashCollected || report.repairIncome || 0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dotted #166534; padding-top: 2px;">
              <span>Total In:</span>
              <strong style="font-variant-numeric: tabular-nums;">${formatCurrency(report.dailyCashSummary?.totalCashIn || ((report.payments?.cash || 0) + (report.repairIncome || 0)))}</strong>
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #b91c1c; padding: 8px; border-radius: 4px; background: #fef2f2;">
            <div style="color: #b91c1c; font-size: 11px; font-weight: bold;">CASH OUTFLOW</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <span>Cash Refunds:</span>
              <strong style="color: #b91c1c; font-variant-numeric: tabular-nums;">-${formatCurrency(report.dailyCashSummary?.cashRefunds || 0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dotted #b91c1c; padding-top: 2px;">
              <span>Total Out:</span>
              <strong style="color: #b91c1c; font-variant-numeric: tabular-nums;">-${formatCurrency(report.dailyCashSummary?.totalCashOut || (report.dailyCashSummary?.cashRefunds || 0))}</strong>
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #000; padding: 8px; border-radius: 4px; background: #f9fafb; display: flex; flex-direction: column; justify-content: center; text-align: center;">
            <div style="font-size: 11px; font-weight: bold;">NET CASH MOVEMENT</div>
            <div style="font-size: 18px; font-weight: 900; margin-top: 4px; color: ${(report.dailyCashSummary?.netCashMovement || 0) >= 0 ? '#166534' : '#b91c1c'}; font-variant-numeric: tabular-nums;">
              ${formatCurrency(report.dailyCashSummary?.netCashMovement || 0)}
            </div>
          </div>
        </div>
      </div>

      <!-- Day's Sales Log -->
      <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Invoices Issued (${(report.sales || []).length})</h4>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee;">
          <thead>
            <tr style="background: #f9fafb; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #ddd;">
              <th style="padding: 4px; text-align: left;">Invoice #</th>
              <th style="padding: 4px; text-align: left;">Time</th>
              <th style="padding: 4px; text-align: left;">Cashier</th>
              <th style="padding: 4px; text-align: left;">Customer</th>
              <th style="padding: 4px; text-align: center;">Status</th>
              <th style="padding: 4px; text-align: right;">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows || `<tr><td colspan="6" style="padding: 8px; text-align: center; color: #888;">No invoices issued on this date.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 11px;">
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #000; height: 35px;"></div>
          <div style="margin-top: 4px; font-weight: bold;">Branch Manager / Cashier</div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #000; height: 35px;"></div>
          <div style="margin-top: 4px; font-weight: bold;">Super Admin / Auditor</div>
        </div>
      </div>
    </div>
  `;
}

// ── 8. BATCH INVOICES PRINTING (Multi-page Invoices Bundle) ───────────────────
export function renderDailyInvoicesBatchHTML(
  sales: Sale[],
  itemsBySaleId: Record<string, SaleItem[]>,
  shop: Shop
): string {
  if (!sales || sales.length === 0) {
    return `<div style="padding: 20px; text-align: center; font-family: sans-serif;">No invoices found to print for this day.</div>`;
  }

  const invoicesHTML = sales
    .map((sale) => {
      const items = itemsBySaleId[sale.id] || [];
      return `
        <div style="page-break-after: always; padding-bottom: 24px; margin-bottom: 24px;">
          ${renderSaleReceiptHTML(sale, items, shop, true)}
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; background: #fff;">
      <style>
        @media print {
          @page { margin: 5mm; }
          div { page-break-inside: avoid; }
        }
      </style>
      ${invoicesHTML}
    </div>
  `;
}

// ── 9. DAY-END RECONCILIATION & AUDIT STATUS (Super Admin Exclusive) ──────────
export function renderDayEndStatusReportHTML(
  statusData: any,
  shopName: string,
  generatedBy: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 15mm; color: #111; background: #fff;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h2 style="margin: 0 0 4px; font-size: 18px; text-transform: uppercase;">APEX FOOTWEAR - END-OF-DAY STATUS AUDIT</h2>
          <div style="font-size: 13px; font-weight: bold;">OUTLET: ${shopName.toUpperCase()} &nbsp;|&nbsp; DATE: ${statusData.dateKey}</div>
          <div style="font-size: 11px; color: #555;">Audited by: ${generatedBy} &nbsp;|&nbsp; Printed at: ${formatDate(Date.now())}</div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 900; background: ${(!statusData.missingInvoices || statusData.missingInvoices.length === 0) ? '#dcfce7; color: #166534' : '#fee2e2; color: #991b1b'}; border: 1px solid #000;">
            ${(!statusData.missingInvoices || statusData.missingInvoices.length === 0) ? "INVOICES INTACT" : "SEQUENCE GAP DETECTED"}
          </div>
        </div>
      </div>

      <!-- Invoice Counts by Status -->
      <div style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Invoice Status Breakdown</h4>
        <div style="display: flex; gap: 8px; font-size: 12px;">
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; text-align: center; border-radius: 4px;">
            <div style="color: #555; font-size: 11px;">Completed</div>
            <div style="font-size: 16px; font-weight: bold; color: #166534;">${statusData.completedInvoices}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; text-align: center; border-radius: 4px;">
            <div style="color: #555; font-size: 11px;">Partial Return</div>
            <div style="font-size: 16px; font-weight: bold; color: #b45309;">${statusData.partiallyReturnedInvoices}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; text-align: center; border-radius: 4px;">
            <div style="color: #555; font-size: 11px;">Full Return</div>
            <div style="font-size: 16px; font-weight: bold; color: #b91c1c;">${statusData.fullyReturnedInvoices}</div>
          </div>
          <div style="flex: 1; border: 1px solid #ccc; padding: 8px; text-align: center; border-radius: 4px;">
            <div style="color: #555; font-size: 11px;">Cancelled</div>
            <div style="font-size: 16px; font-weight: bold; color: #6b7280;">${statusData.cancelledInvoices}</div>
          </div>
          <div style="flex: 1; border: 1px solid #000; padding: 8px; text-align: center; border-radius: 4px; background: #f9fafb;">
            <div style="color: #111; font-size: 11px; font-weight: bold;">Total Invoices</div>
            <div style="font-size: 16px; font-weight: 900;">${statusData.totalInvoices}</div>
          </div>
        </div>
      </div>

      <!-- Sequence Integrity -->
      <div style="margin-bottom: 16px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; font-size: 12px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Invoice Sequential Integrity</h4>
        <div style="display: flex; justify-content: space-between;">
          <div>First Invoice of Day: <strong>${statusData.firstInvoiceNumber || "None"}</strong></div>
          <div>Last Invoice of Day: <strong>${statusData.lastInvoiceNumber || "None"}</strong></div>
          <div>
            Sequence Gap: 
            ${
              statusData.missingInvoices && statusData.missingInvoices.length > 0
                ? `<span style="color: #b91c1c; font-weight: bold;">Missing (${statusData.missingInvoices.join(", ")})</span>`
                : `<span style="color: #166534; font-weight: bold;">Intact (No missing invoices)</span>`
            }
          </div>
        </div>
      </div>

      <!-- Daily Cash Summary Reconciliation -->
      <div style="margin-bottom: 20px; border: 1px solid #ccc; border-radius: 4px; padding: 12px;">
        <h4 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase;">Daily Cash Movement & Tender Reconciliation</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase;">
              <th style="padding: 6px; text-align: left;">Category</th>
              <th style="padding: 6px; text-align: right;">Amount</th>
              <th style="padding: 6px; text-align: left;">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">Cash Sales (Tendered - Change)</td>
              <td style="padding: 6px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">${formatCurrency(statusData.dailyCashSummary?.cashSales || statusData.payments?.cash || 0)}</td>
              <td style="padding: 6px; color: #555;">Completed cash sales</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">Repair Cash Collected</td>
              <td style="padding: 6px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">${formatCurrency(statusData.dailyCashSummary?.repairCashCollected || statusData.repairIncome || 0)}</td>
              <td style="padding: 6px; color: #555;">Advance + delivery cash settled today</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">Customer Cash Refunds</td>
              <td style="padding: 6px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; color: #b91c1c;">-${formatCurrency(statusData.dailyCashSummary?.cashRefunds || 0)}</td>
              <td style="padding: 6px; color: #555;">Cash returned on returns</td>
            </tr>
            <tr style="background: #f3f4f6; font-weight: 900; font-size: 13px; border-top: 2px solid #000;">
              <td style="padding: 8px 6px;">NET CASH MOVEMENT:</td>
              <td style="padding: 8px 6px; text-align: right; font-variant-numeric: tabular-nums; color: ${(statusData.dailyCashSummary?.netCashMovement || 0) >= 0 ? '#166534' : '#b91c1c'};">${formatCurrency(statusData.dailyCashSummary?.netCashMovement || 0)}</td>
              <td style="padding: 8px 6px; font-size: 11px; font-weight: normal; color: #555;">Inflow minus Outflow</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 11px;">
        <div style="text-align: center; width: 220px;">
          <div style="border-bottom: 1px solid #000; height: 35px;"></div>
          <div style="margin-top: 4px; font-weight: bold;">Senior Branch Manager</div>
        </div>
        <div style="text-align: center; width: 220px;">
          <div style="border-bottom: 1px solid #000; height: 35px;"></div>
          <div style="margin-top: 4px; font-weight: bold;">Super Admin Sign-off</div>
        </div>
      </div>
    </div>
  `;
}

// ── 8. CUSTOMER PAYMENT RECEIPT (80mm Thermal Slip) ─────────────────────────
export function renderCustomerPaymentReceiptHTML(
  receipt: CustomerPaymentReceipt,
  shop: Shop,
  currentBalance?: number
): string {
  const settledRows = (receipt.settledInvoices || [])
    .map(
      (inv) => `
    <tr>
      <td style="padding: 4px 0; font-size: 11px;">${inv.invoiceNumber}</td>
      <td style="padding: 4px 0; text-align: right; font-variant-numeric: tabular-nums; font-size: 11px;">
        ${formatCurrency(inv.amountApplied)}
      </td>
      <td style="padding: 4px 0; text-align: right; font-variant-numeric: tabular-nums; font-size: 11px;">
        ${formatCurrency(inv.balanceRemaining)}
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
          ${shop.name}
        </h2>
        <div style="font-size: 11px; margin-top: 2px;">${shop.address}</div>
        <div style="font-size: 11px;">Tel: ${shop.phone}</div>
      </div>

      <div style="text-align: center; font-weight: 900; font-size: 13px; border: 1px solid #000; padding: 3px; margin-bottom: 8px; letter-spacing: 0.5px;">
        CUSTOMER PAYMENT RECEIPT
      </div>

      <div style="font-size: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Receipt:</strong> ${receipt.paymentNumber}</span>
          <span><strong>Branch:</strong> ${shop.code}</span>
        </div>
        <div>Date: ${formatDate(receipt.createdAt)}</div>
        <div><strong>Customer:</strong> ${receipt.customerName}</div>
        ${receipt.customerPhone ? `<div>Phone: ${receipt.customerPhone}</div>` : ""}
        <div>Payment Method: <strong>${receipt.method}</strong></div>
        ${receipt.reference ? `<div>Reference: ${receipt.reference}</div>` : ""}
        <div>Received By: ${receipt.receivedByName}</div>
      </div>

      <div style="background: #f4f4f4; border: 1px solid #ccc; padding: 10px; text-align: center; margin: 10px 0;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #555;">Amount Received</div>
        <div style="font-size: 24px; font-weight: 900; font-variant-numeric: tabular-nums;">${formatCurrency(receipt.amount)}</div>
      </div>

      ${
        receipt.settledInvoices && receipt.settledInvoices.length > 0
          ? `
        <div style="margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px;">
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Invoices Settled (FIFO):</div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid #000; font-size: 10px; text-align: left;">
                <th style="padding: 2px 0;">Invoice</th>
                <th style="padding: 2px 0; text-align: right;">Applied</th>
                <th style="padding: 2px 0; text-align: right;">Remaining</th>
              </tr>
            </thead>
            <tbody>
              ${settledRows}
            </tbody>
          </table>
        </div>
      `
          : ""
      }

      ${
        currentBalance !== undefined
          ? `
        <div style="margin-top: 8px; border-top: 1px solid #000; padding-top: 6px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold;">
          <span>Remaining Balance:</span>
          <span style="font-variant-numeric: tabular-nums; color: ${currentBalance > 0 ? '#b91c1c' : '#166534'};">${formatCurrency(currentBalance)}</span>
        </div>
      `
          : ""
      }

      ${receipt.note ? `<div style="font-size: 11px; color: #444; margin-top: 6px;">Note: ${receipt.note}</div>` : ""}

      <div style="margin-top: 28px; padding-top: 6px; border-top: 1px dashed #000; display: flex; justify-content: space-between; font-size: 10px;">
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px solid #000; height: 25px;"></div>
          <div style="margin-top: 3px;">Cashier Signature</div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px solid #000; height: 25px;"></div>
          <div style="margin-top: 3px;">Customer Signature</div>
        </div>
      </div>
    </div>
  `;
}

// ── 9. CASH ADVANCE VOUCHER (80mm Slip & A4 Format) ──────────────────────────
export function renderCashAdvanceVoucherHTML(
  voucher: CashAdvanceReceipt,
  shop: Shop
): string {
  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
          ${shop.name}
        </h2>
        <div style="font-size: 11px; margin-top: 2px;">${shop.address}</div>
        <div style="font-size: 11px;">Tel: ${shop.phone}</div>
      </div>

      <div style="text-align: center; font-weight: 900; font-size: 13px; border: 2px solid #000; padding: 4px; margin-bottom: 10px; letter-spacing: 0.5px;">
        *** CASH ADVANCE VOUCHER ***
      </div>

      <div style="font-size: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Voucher #:</strong> ${voucher.voucherNumber}</span>
          <span><strong>Branch:</strong> ${shop.code}</span>
        </div>
        <div>Date: ${formatDate(voucher.date || voucher.createdAt)}</div>
        <div style="margin-top: 4px;"><strong>Issued To:</strong> ${voucher.customerName}</div>
        ${voucher.customerPhone ? `<div>Phone: ${voucher.customerPhone}</div>` : ""}
        <div>Authorized By: ${voucher.issuedByName}</div>
      </div>

      <div style="background: #fef2f2; border: 1px solid #f87171; padding: 12px; text-align: center; margin: 12px 0;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #991b1b;">Advance Cash Paid Out</div>
        <div style="font-size: 26px; font-weight: 900; color: #991b1b; font-variant-numeric: tabular-nums; margin-top: 2px;">
          ${formatCurrency(voucher.amount)}
        </div>
      </div>

      ${voucher.note ? `<div style="font-size: 11px; margin: 6px 0;"><strong>Reason / Notes:</strong> ${voucher.note}</div>` : ""}

      <div style="margin-top: 30px; padding-top: 6px; border-top: 1px dashed #000; display: flex; justify-content: space-between; font-size: 10px;">
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px solid #000; height: 28px;"></div>
          <div style="margin-top: 4px;">Authorized By (Admin)</div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px solid #000; height: 28px;"></div>
          <div style="margin-top: 4px;">Receiver Signature</div>
        </div>
      </div>
    </div>
  `;
}

// ── 10. CUSTOMER STATEMENT (A4 Document Format) ──────────────────────────────
export function renderCustomerStatementHTML(
  customer: Customer,
  ledger: CustomerLedgerEntry[],
  aged: { d30: number; d60: number; d90: number; d90Plus: number; total: number },
  shop: Shop
): string {
  let runningBal = 0;
  const sortedLedger = [...ledger].sort((a, b) => a.createdAt - b.createdAt);
  const rows = sortedLedger
    .map((e) => {
      const isDebit = e.direction === "DEBIT";
      const debitStr = isDebit ? formatCurrency(e.amount) : "-";
      const creditStr = !isDebit ? formatCurrency(e.amount) : "-";
      runningBal = isDebit ? runningBal + e.amount : runningBal - e.amount;

      return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px;">${formatDate(e.createdAt)}</td>
        <td style="padding: 8px 10px; font-weight: 600;">${e.type.replace(/_/g, " ")}</td>
        <td style="padding: 8px 10px;">${e.referenceNumber || "-"}</td>
        <td style="padding: 8px 10px; text-align: right; font-variant-numeric: tabular-nums;">${debitStr}</td>
        <td style="padding: 8px 10px; text-align: right; font-variant-numeric: tabular-nums;">${creditStr}</td>
        <td style="padding: 8px 10px; text-align: right; font-variant-numeric: tabular-nums; font-weight: bold;">${formatCurrency(runningBal)}</td>
        <td style="padding: 8px 10px; color: #6b7280; font-size: 11px;">${e.note || "-"}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
            ${shop.name}
          </h1>
          <div style="font-size: 12px; margin-top: 4px; color: #4b5563;">${shop.address}</div>
          <div style="font-size: 12px; color: #4b5563;">Tel: ${shop.phone}</div>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1d4ed8;">STATEMENT OF ACCOUNT</h2>
          <div style="font-size: 12px; margin-top: 4px;">Statement Date: ${formatDate(Date.now())}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280;">Customer Account</div>
          <div style="font-size: 18px; font-weight: 700; color: #111; margin-top: 2px;">${customer.name}</div>
          <div style="font-size: 13px; color: #374151;">Phone: ${customer.phone}</div>
          ${customer.address ? `<div style="font-size: 13px; color: #374151;">Address: ${customer.address}</div>` : ""}
          <div style="font-size: 12px; margin-top: 4px;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${customer.type}</span></div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280;">Account Summary</div>
          <div style="font-size: 22px; font-weight: 900; color: ${aged.total > 0 ? '#b91c1c' : '#166534'}; margin-top: 2px;">
            ${formatCurrency(aged.total)}
          </div>
          <div style="font-size: 12px; color: #6b7280;">Current Outstanding Balance</div>
          ${customer.creditLimit ? `<div style="font-size: 12px; color: #374151; margin-top: 4px;">Credit Limit: ${formatCurrency(customer.creditLimit)}</div>` : ""}
        </div>
      </div>

      <!-- Aged Debt Breakdown -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; color: #374151;">Aged Balance Breakdown</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; text-align: center;">
          <div style="padding: 10px; background: #f9fafb; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 11px; color: #6b7280;">0 - 30 Days</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${formatCurrency(aged.d30)}</div>
          </div>
          <div style="padding: 10px; background: #f9fafb; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 11px; color: #6b7280;">31 - 60 Days</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${formatCurrency(aged.d60)}</div>
          </div>
          <div style="padding: 10px; background: #f9fafb; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 11px; color: #6b7280;">61 - 90 Days</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${formatCurrency(aged.d90)}</div>
          </div>
          <div style="padding: 10px; background: #fef2f2; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 11px; color: #b91c1c; font-weight: bold;">Over 90 Days</div>
            <div style="font-size: 14px; font-weight: 700; color: #b91c1c; margin-top: 2px;">${formatCurrency(aged.d90Plus)}</div>
          </div>
          <div style="padding: 10px; background: #f3f4f6;">
            <div style="font-size: 11px; color: #111; font-weight: bold;">Total Due</div>
            <div style="font-size: 15px; font-weight: 900; margin-top: 2px;">${formatCurrency(aged.total)}</div>
          </div>
        </div>
      </div>

      <!-- Ledger Transactions -->
      <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; color: #374151;">Transaction History</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f3f4f6; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; text-align: left;">
            <th style="padding: 8px 10px;">Date</th>
            <th style="padding: 8px 10px;">Type</th>
            <th style="padding: 8px 10px;">Ref #</th>
            <th style="padding: 8px 10px; text-align: right;">Debit (Charges)</th>
            <th style="padding: 8px 10px; text-align: right;">Credit (Payments)</th>
            <th style="padding: 8px 10px; text-align: right;">Balance</th>
            <th style="padding: 8px 10px;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="padding: 16px; text-align: center; color: #9ca3af;">No transaction history found.</td></tr>'}
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
        <div>For queries regarding this statement, contact ${shop.phone}</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  `;
}

// ==========================================
// PURCHASE BILL & CHEQUE VOUCHER (WP7)
// ==========================================

export function renderPurchaseBillHTML(
  purchase: Purchase,
  shop: Shop,
  options: { isDuplicate?: boolean; width?: "80mm" | "A4" } = {}
): string {
  const isDuplicate = options.isDuplicate || false;
  const totalUnits = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

  const paymentText =
    purchase.paymentMethod === "CASH"
      ? "PAID IN CASH"
      : purchase.paymentMethod === "CHEQUE"
      ? `PAID BY CHEQUE (Chq #: ${purchase.chequeDetails?.chequeNumber || "-"}, Bank: ${purchase.chequeDetails?.bankName || "-"}, Due: ${formatDate(purchase.chequeDetails?.chequeDate || 0)})`
      : purchase.paymentMethod === "CREDIT"
      ? "CREDIT PURCHASE (PAY LATER)"
      : purchase.paymentMethod === "BANK_TRANSFER"
      ? "PAID VIA BANK TRANSFER"
      : purchase.paymentMethod === "PARTIAL"
      ? `PARTIAL PAYMENT (Paid: ${formatCurrency(purchase.paidAmount || 0)}, Credit: ${formatCurrency(Math.max(0, purchase.totalAmount - (purchase.paidAmount || 0)))})`
      : "PURCHASE INWARD";

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 4mm; margin: 0 auto; background: #fff; color: #000; box-sizing: border-box; font-size: 11px; line-height: 1.35;">
      ${isDuplicate ? `
        <div style="border: 2px dashed #b91c1c; color: #b91c1c; text-align: center; font-weight: bold; font-size: 13px; padding: 4px; margin-bottom: 8px;">
          *** DUPLICATE REPRINT ***
        </div>
      ` : ""}

      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: bold; text-transform: uppercase;">${shop.name}</div>
        <div style="font-size: 10px; color: #333;">${shop.address || ""}</div>
        <div style="font-size: 10px; color: #333;">Tel: ${shop.phone || ""}</div>
        <div style="margin-top: 6px; font-size: 12px; font-weight: bold; letter-spacing: 1px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0;">
          PURCHASE INWARD BILL
        </div>
      </div>

      <div style="margin-bottom: 6px; font-size: 10.5px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Bill No:</span>
          <strong>${purchase.purchaseNumber}</strong>
        </div>
        ${purchase.supplierBillNumber ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Supplier Inv:</span>
            <span>${purchase.supplierBillNumber}</span>
          </div>
        ` : ""}
        <div style="display: flex; justify-content: space-between;">
          <span>Date:</span>
          <span>${formatDate(purchase.invoiceDate || purchase.receivedAt)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Supplier:</span>
          <strong>${purchase.supplierNameCache}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Branch:</span>
          <span>${shop.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Issued By:</span>
          <span>${purchase.createdByNameCache || purchase.receivedBy}</span>
        </div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px;">
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>ITEM / DESCRIPTION</span>
          <span>TOTAL</span>
        </div>
        ${purchase.items.map((item) => `
          <div style="margin-bottom: 4px;">
            <div style="font-weight: bold; font-size: 10.5px;">${item.variantDescriptionCache}</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #222;">
              <span>${item.quantity} units @ ${formatCurrency(item.unitCost)}</span>
              <span>${formatCurrency(item.lineTotal)}</span>
            </div>
          </div>
        `).join("")}
      </div>

      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Total Units:</span>
          <strong>${totalUnits}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px solid #000;">
          <span>TOTAL AMOUNT:</span>
          <span>${formatCurrency(purchase.totalAmount)}</span>
        </div>
      </div>

      <div style="background: #f4f4f4; border: 1px solid #ccc; padding: 6px; text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 12px;">
        ${paymentText}
      </div>

      ${purchase.notes ? `
        <div style="font-size: 10px; margin-bottom: 10px; font-style: italic;">
          Notes: ${purchase.notes}
        </div>
      ` : ""}

      <div style="margin-top: 24px; padding-top: 12px; font-size: 10px;">
        <div style="margin-bottom: 20px;">
          <div>Issued By: _________________________________</div>
          <div style="font-size: 9px; color: #555; margin-top: 2px;">${purchase.createdByNameCache || purchase.receivedBy}</div>
        </div>
        <div>
          <div>Receiver / Supplier: _______________________</div>
          <div style="font-size: 9px; color: #555; margin-top: 2px;">Authorized Signature & Date</div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 16px; font-size: 9px; color: #666; border-top: 1px dashed #999; padding-top: 6px;">
        Stock verified and received into inventory.
      </div>
    </div>
  `;
}

export function renderChequeVoucherHTML(
  cheque: Cheque,
  purchase: Purchase,
  shop: Shop
): string {
  return `
    <div style="font-family: Arial, sans-serif; width: 148mm; padding: 10mm; margin: 0 auto; background: #fff; color: #000; border: 2px solid #000; box-sizing: border-box; font-size: 12px; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
        <div>
          <div style="font-size: 18px; font-weight: bold; text-transform: uppercase;">${shop.name}</div>
          <div style="font-size: 11px; color: #444;">${shop.address || ""} | Tel: ${shop.phone || ""}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 15px; font-weight: bold; color: #0284c7;">CHEQUE PAYMENT VOUCHER</div>
          <div style="font-size: 11px; margin-top: 2px;">Voucher Date: ${formatDate(Date.now())}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px;">
        <div><strong>Payee Supplier:</strong> ${cheque.supplierNameCache}</div>
        <div><strong>Cheque Number:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: bold;">${cheque.chequeNumber}</span></div>
        <div><strong>Bank:</strong> ${cheque.bankName}</div>
        <div><strong>Cheque Due Date:</strong> ${formatDate(cheque.dueDate)}</div>
        <div><strong>Linked Purchase Bill:</strong> ${purchase.purchaseNumber}</div>
        <div><strong>Branch:</strong> ${shop.name}</div>
      </div>

      <div style="margin-bottom: 20px; padding: 12px; border: 1px dashed #000; text-align: center; background: #f1f5f9;">
        <div style="font-size: 12px; color: #475569; text-transform: uppercase; font-weight: bold;">Cheque Amount</div>
        <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px; font-variant-numeric: tabular-nums;">
          ${formatCurrency(cheque.amount)}
        </div>
      </div>

      <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px;">
        <div style="text-align: center; width: 45%;">
          <div style="border-top: 1px solid #000; padding-top: 4px; font-weight: bold;">
            Prepared By: ${cheque.issuedByName || "Cashier"}
          </div>
          <div style="color: #64748b; font-size: 10px;">Signature & Stamp</div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-top: 1px solid #000; padding-top: 4px; font-weight: bold;">
            Payee / Supplier Acknowledgment
          </div>
          <div style="color: #64748b; font-size: 10px;">Signature & Date</div>
        </div>
      </div>
    </div>
  `;
}
