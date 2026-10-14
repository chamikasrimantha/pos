// src/lib/receipt-generator.ts
// Pixel-accurate, vector thermal slip and barcode label generator
import {
  Sale,
  SaleItem,
  CashierShift,
  ShoeRepairOrder,
  StockTransfer,
  Shop,
  ProductVariant,
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
  shop: Shop
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

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
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
        <div>Cashier: ${sale.cashierNameCache} (Shift #${sale.shiftId.slice(-6)})</div>
        ${sale.customerName ? `<div>Customer: ${sale.customerName} (${sale.customerPhone || "-"})</div>` : ""}
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

// ── 2. CASHIER SHIFT Z-REPORT (Reconciliation Slip) ─────────────────────────
export function renderZReportHTML(shift: CashierShift, shop: Shop): string {
  const isBalanced = (shift.variance || 0) === 0;
  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 14px 8px; color: #000; line-height: 1.35; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 17px; font-weight: 900;">Z-REPORT — SHIFT RECONCILIATION</h2>
        <div style="font-size: 13px; font-weight: bold; margin-top: 3px;">${shop.name}</div>
        <div style="font-size: 11px;">Shift No: ${shift.shiftNumber}</div>
      </div>

      <div style="font-size: 12px; margin-bottom: 8px;">
        <div><strong>Cashier:</strong> ${shift.cashierNameCache}</div>
        <div><strong>Opened:</strong> ${formatDate(shift.openedAt)}</div>
        <div><strong>Closed:</strong> ${shift.closedAt ? formatDate(shift.closedAt) : "ACTIVE (Open)"}</div>
        <div><strong>Status:</strong> ${shift.status}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>(+) Opening Float:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.openingFloat)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>(+) Cash Sales:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.cashSales)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>(+) Repair Cash Collected:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.repairCashIn || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>(-) Cash Refunds:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(shift.cashRefunds || 0)}</span>
        </div>
        ${
          shift.cashPayouts > 0
            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>(-) Cash Payouts:</span>
                <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(shift.cashPayouts)}</span>
              </div>`
            : ""
        }
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
          <span>EXPECTED DRAWER CASH:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.expectedCash)}</span>
        </div>
      </div>

      <div style="margin: 8px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
          <span>PHYSICAL COUNT SUBMITTED:</span>
          <span style="font-variant-numeric: tabular-nums;">${shift.actualCashCounted !== undefined ? formatCurrency(shift.actualCashCounted) : "Pending"}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; margin-top: 4px; color: ${
          isBalanced ? "#15803d" : "#b91c1c"
        };">
          <span>VARIANCE:</span>
          <span style="font-variant-numeric: tabular-nums;">${shift.variance !== undefined ? (shift.variance > 0 ? `+${formatCurrency(shift.variance)}` : formatCurrency(shift.variance)) : "-"}</span>
        </div>
        ${
          shift.closingNotes
            ? `<div style="font-size: 11px; margin-top: 6px; font-style: italic;">
                <strong>Closing Notes:</strong> ${shift.closingNotes}
              </div>`
            : ""
        }
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Non-Cash Settlements:</div>
        <div style="display: flex; justify-content: space-between;">
          <span>Card Payments:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.cardSales)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Bank Transfers:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.transferSales)}</span>
        </div>
      </div>

      <div style="margin-top: 28px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between;">
          <div>____________________<br/>Cashier Signature</div>
          <div>____________________<br/>Supervisor Verification</div>
        </div>
      </div>
    </div>
  `;
}

// ── 3. SHOE REPAIR INTAKE CLAIM SLIP & SHOE ATTACHMENT TAG ─────────────────
export function renderRepairIntakeSlipHTML(
  repair: ShoeRepairOrder,
  shop: Shop
): string {
  const repairBarcode = generateBarcodeSVG(repair.repairNumber, {
    format: "CODE128",
    height: 36,
    width: 2,
    displayValue: true,
    fontSize: 11,
    margin: 4,
  });

  return `
    <div style="font-family: Arial, sans-serif; width: 300px; margin: 0 auto; padding: 10px; color: #000; line-height: 1.35; background: #fff;">
      <!-- PART 1: CUSTOMER CLAIM SLIP -->
      <div style="border: 2px solid #000; padding: 10px; margin-bottom: 14px;">
        <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase;">REPAIR INTAKE CLAIM SLIP</h3>
          <div style="font-size: 12px; font-weight: bold;">${shop.name}</div>
          <div style="font-size: 11px;">Tel: ${shop.phone}</div>
        </div>

        <div style="text-align: center; margin-bottom: 6px;">
          ${repairBarcode}
        </div>

        <div style="font-size: 12px; margin-bottom: 6px;">
          <div><strong>Customer:</strong> ${repair.customerName}</div>
          <div><strong>Contact:</strong> ${repair.customerPhone}</div>
          <div><strong>Intake Date:</strong> ${formatDate(repair.receivedAt)}</div>
          <div style="color: #b91c1c; font-weight: 700;"><strong>Promised Date:</strong> ${formatDate(repair.promisedDate)}</div>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 12px; margin: 6px 0;">
          <div><strong>Shoe:</strong> ${repair.shoeBrand} ${repair.shoeModel} (${repair.shoeColor}, Size ${repair.shoeSize})</div>
          <div><strong>Origin:</strong> ${repair.isStorePurchased ? "Store Purchase" : "External Customer Shoe"}</div>
          <div style="margin-top: 4px;"><strong>Diagnosis / Task:</strong><br/><span style="color: #222;">${repair.issueDescription}</span></div>
        </div>

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

        <div style="font-size: 10px; color: #444; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; text-align: center;">
          * Present this slip for shoe collection.<br/>
          * Shoes not collected within 30 days are subject to disposal.
        </div>
      </div>

      <!-- PART 2: PHYSICAL SHOE ATTACHMENT TAG -->
      <div style="border: 2px dashed #000; padding: 8px; background: #fffbe8;">
        <div style="text-align: center; font-size: 11px; font-weight: 900;">[ WORKSHOP SHOE ATTACHMENT TAG ]</div>
        <div style="text-align: center; margin: 4px 0;">
          ${repairBarcode}
        </div>
        <div style="font-size: 11px;">
          <div><strong>Cust:</strong> ${repair.customerName} (${repair.customerPhone})</div>
          <div><strong>Shoe:</strong> ${repair.shoeBrand} | Sz: ${repair.shoeSize} | ${repair.shoeColor}</div>
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
  const finalPay = Math.max(0, (repair.finalCost || repair.estimatedCost) - repair.advancePaid);

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
        <div><strong>Shoe Article:</strong> ${repair.shoeBrand} ${repair.shoeModel} (${repair.shoeColor}, Size ${repair.shoeSize})</div>
        <div style="margin-top: 4px;"><strong>Service Rendered:</strong> ${repair.issueDescription}</div>
      </div>

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

      <div style="text-align: center; margin-top: 14px; font-size: 11px; border-top: 1px dashed #000; padding-top: 8px;">
        Goods collected in satisfactory condition.<br/>
        Workshop stitching & sole bond warranty: 14 days.
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
  const itemRows = transfer.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #000; font-size: 12px;">
      <td style="padding: 6px 4px; text-align: center;">${idx + 1}</td>
      <td style="padding: 6px 4px; font-weight: 700;">${it.variantDescriptionCache}</td>
      <td style="padding: 6px 4px; text-align: center; font-weight: 900;">${it.dispatchedQuantity}</td>
      <td style="padding: 6px 4px; text-align: center;">${it.receivedQuantity > 0 ? it.receivedQuantity : "[ &nbsp; ]"}</td>
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
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">INTER-SHOP STOCK TRANSFER NOTE</h2>
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
        <span><strong>Dispatched Date:</strong> ${formatDate(transfer.dispatchedAt)}</span>
        <span><strong>Status:</strong> ${transfer.status}</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #000;">
        <thead>
          <tr style="background: #000; color: #fff; font-size: 11px; text-align: left;">
            <th style="padding: 6px 4px; width: 24px; text-align: center;">#</th>
            <th style="padding: 6px 4px;">Footwear Variant</th>
            <th style="padding: 6px 4px; text-align: center; width: 70px;">Dispatched</th>
            <th style="padding: 6px 4px; text-align: center; width: 70px;">Received</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr style="font-weight: 900; font-size: 13px; border-top: 2px solid #000; background: #f9fafb;">
            <td colspan="2" style="padding: 8px 4px;">TOTAL PAIRS:</td>
            <td style="padding: 8px 4px; text-align: center;">${transfer.totalQuantity}</td>
            <td style="padding: 8px 4px; text-align: center;">-</td>
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
          <span>${transfer.receivedBy || "Pending Reception"}</span>
        </div>
      </div>
    </div>
  `;
}

// ── 6. THERMAL BARCODE LABELS (50x30mm vector thermal sticker) ───────────────
export function renderThermalBarcodeLabelHTML(
  variant: ProductVariant,
  copies: number = 1
): string {
  const barcodeSVG = generateBarcodeSVG(variant.barcode, {
    format: "EAN13",
    height: 38,
    width: 1.8,
    displayValue: true,
    fontSize: 10,
    margin: 2,
  });

  const singleLabel = `
    <div style="width: 50mm; height: 30mm; border: 1px solid #000; padding: 2mm 3mm; box-sizing: border-box; text-align: center; background: #fff; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; margin: 4px auto;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000; padding-bottom: 1px;">
        <span style="font-size: 8pt; font-weight: 900; text-transform: uppercase;">${variant.brandNameCache}</span>
        <span style="font-size: 10pt; font-weight: 900;">${formatCurrency(variant.sellingPrice)}</span>
      </div>
      
      <div style="font-size: 8pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
        ${variant.productNameCache}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 7.5pt; font-weight: 600; color: #222;">
        <span>${variant.colorNameCache}</span>
        <span style="font-weight: 900; font-size: 9pt;">SIZE: ${variant.sizeLabelCache}</span>
      </div>

      <div style="margin: 0 auto; line-height: 1;">
        ${barcodeSVG}
      </div>
    </div>
  `;

  return `
    <div style="font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center;">
      ${Array.from({ length: copies }).map(() => singleLabel).join("")}
    </div>
  `;
}
