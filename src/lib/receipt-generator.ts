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
import { computeExpectedDrawerCash } from "./shift-math";

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

  return `
    <div style="font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 12px 8px; color: #000; line-height: 1.35; background: #fff;">
      ${
        isDuplicate
          ? `<div style="text-align: center; font-weight: 900; font-size: 13px; border: 2px dashed #000; padding: 4px; margin-bottom: 8px; letter-spacing: 1px;">
              *** DUPLICATE INVOICE ***
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
          <span>Opening float:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.openingFloat)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Cash sales:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.cashSales)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Repair cash collected:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(shift.repairCashIn || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Cash refunds:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(shift.cashRefunds || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Cash removed from the drawer:</span>
          <span style="font-variant-numeric: tabular-nums;">-${formatCurrency(shift.cashPayouts || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
          <span>Expected drawer cash:</span>
          <span style="font-variant-numeric: tabular-nums;">${formatCurrency(computeExpectedDrawerCash(shift))}</span>
        </div>
      </div>

      <div style="margin: 8px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
          <span>Counted cash:</span>
          <span style="font-variant-numeric: tabular-nums;">${shift.actualCashCounted !== undefined ? formatCurrency(shift.actualCashCounted) : "Pending"}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; margin-top: 4px; color: ${
          isBalanced ? "#15803d" : "#b91c1c"
        };">
          <span>Variance:</span>
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

// ── 6. THERMAL BARCODE LABELS (50x30mm vector thermal sticker & A4 Sheet) ───────
export function renderSingleThermalBarcodeLabel(
  variant: ProductVariant,
  outletName: string = "APEX FOOTWEAR"
): string {
  const barcodeSVG = generateBarcodeSVG(variant.barcode, {
    height: 28,
    width: 1.5,
    displayValue: false,
    margin: 0,
  });

  return `
    <div class="thermal-barcode-label-item" style="width: 50mm; height: 30mm; max-width: 50mm; max-height: 30mm; border: 1px solid #111; padding: 1.8mm 2.2mm; box-sizing: border-box; background: #fff; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; margin: 0 auto; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <!-- Store Header & Brand -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; padding-bottom: 1.5px; line-height: 1;">
        <span style="font-size: 6.5pt; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #111;">${outletName}</span>
        <span style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; color: #000;">${variant.brandNameCache || "BRAND"}</span>
      </div>

      <!-- Product Name -->
      <div style="font-size: 7pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; color: #000; text-align: left; line-height: 1.1;">
        ${variant.productNameCache}
      </div>

      <!-- Attributes: Color & Size -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; margin-top: 1px; line-height: 1.1;">
        <span style="color: #222; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">
          COL: <strong>${variant.colorNameCache}</strong>
        </span>
        <span style="font-weight: 900; font-size: 7.5pt; background: #000; color: #fff; padding: 1px 4px; border-radius: 2px; white-space: nowrap;">
          SIZE: ${variant.sizeLabelCache}
        </span>
      </div>

      <!-- Price -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1px; line-height: 1.1;">
        <span style="font-size: 5.5pt; font-weight: 700; color: #444; text-transform: uppercase;">MRP (INCL. TAXES)</span>
        <span style="font-size: 9pt; font-weight: 900; color: #000; letter-spacing: -0.3px;">${formatCurrency(variant.sellingPrice)}</span>
      </div>

      <!-- Vector Barcode & Digits -->
      <div style="text-align: center; margin: 0 auto; width: 100%; line-height: 1;">
        <div style="display: flex; justify-content: center; align-items: center; max-height: 28px; width: 100%; overflow: hidden;">
          ${barcodeSVG}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 6.5pt; font-weight: 800; margin-top: 1px; color: #000;">
          <span>SKU: ${variant.sku}</span>
          <span style="letter-spacing: 1px;">${variant.barcode}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderThermalBarcodeLabelHTML(
  variant: ProductVariant,
  copies: number = 1,
  outletName: string = "APEX FOOTWEAR"
): string {
  const singleLabel = renderSingleThermalBarcodeLabel(variant, outletName);
  return `
    <div class="thermal-barcode-label-container" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
      ${Array.from({ length: copies }).map(() => singleLabel).join("")}
    </div>
  `;
}

export function renderBatchThermalBarcodeLabelsHTML(
  items: { variant: ProductVariant; copies: number }[],
  outletName: string = "APEX FOOTWEAR"
): string {
  const labelHTMLs: string[] = [];
  items.forEach((item) => {
    const single = renderSingleThermalBarcodeLabel(item.variant, outletName);
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
  const shiftsRows = (report.shifts || [])
    .map(
      (sh: any) => `
      <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
        <td style="padding: 6px 4px;"><strong>${sh.cashierName}</strong></td>
        <td style="padding: 6px 4px; text-align: center;">${sh.status}</td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.openingFloat)}</td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.cashSales)}</td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.cashDrops)}</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold;">${formatCurrency(sh.expectedCash)}</td>
        <td style="padding: 6px 4px; text-align: right;">${sh.closingCountedCash !== undefined ? formatCurrency(sh.closingCountedCash) : "Open"}</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold; color: ${(sh.variance || 0) < 0 ? '#b91c1c' : '#047857'};">
          ${sh.variance !== undefined ? formatCurrency(sh.variance) : "-"}
        </td>
      </tr>
    `
    )
    .join("");

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

      <!-- Cashier Shifts & Drawer Reconciliation -->
      <div style="margin-bottom: 18px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Cashier Shifts & Drawer Reconciliation</h4>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase;">
              <th style="padding: 6px 4px; text-align: left;">Cashier</th>
              <th style="padding: 6px 4px; text-align: center;">Shift Status</th>
              <th style="padding: 6px 4px; text-align: right;">Opening Float</th>
              <th style="padding: 6px 4px; text-align: right;">Cash Sales</th>
              <th style="padding: 6px 4px; text-align: right;">Safe Drops</th>
              <th style="padding: 6px 4px; text-align: right;">Expected Drawer</th>
              <th style="padding: 6px 4px; text-align: right;">Counted Cash</th>
              <th style="padding: 6px 4px; text-align: right;">Variance</th>
            </tr>
          </thead>
          <tbody>
            ${shiftsRows || `<tr><td colspan="8" style="padding: 8px; text-align: center; color: #888;">No cashier shifts recorded for this day.</td></tr>`}
          </tbody>
        </table>
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
  const shiftsRows = (statusData.shifts || [])
    .map(
      (sh: any) => `
      <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
        <td style="padding: 6px 4px;"><strong>${sh.cashierName}</strong></td>
        <td style="padding: 6px 4px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; background: ${sh.isOpen ? '#fef3c7; color: #b45309' : '#dcfce7; color: #15803d'};">
            ${sh.status}
          </span>
        </td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.openingFloat)}</td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.cashSales)}</td>
        <td style="padding: 6px 4px; text-align: right;">${formatCurrency(sh.cashDrops)}</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold;">${formatCurrency(sh.expectedCash)}</td>
        <td style="padding: 6px 4px; text-align: right;">${sh.closingCountedCash !== undefined ? formatCurrency(sh.closingCountedCash) : "NOT CLOSED"}</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold; color: ${(sh.variance || 0) < 0 ? '#b91c1c' : '#047857'};">
          ${sh.variance !== undefined ? formatCurrency(sh.variance) : "-"}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 15mm; color: #111; background: #fff;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h2 style="margin: 0 0 4px; font-size: 18px; text-transform: uppercase;">APEX FOOTWEAR - END-OF-DAY STATUS AUDIT</h2>
          <div style="font-size: 13px; font-weight: bold;">OUTLET: ${shopName.toUpperCase()} &nbsp;|&nbsp; DATE: ${statusData.dateKey}</div>
          <div style="font-size: 11px; color: #555;">Audited by: ${generatedBy} &nbsp;|&nbsp; Printed at: ${formatDate(Date.now())}</div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 900; background: ${statusData.allShiftsClosed ? '#dcfce7; color: #166534' : '#fee2e2; color: #991b1b'}; border: 1px solid #000;">
            ${statusData.allShiftsClosed ? "ALL SHIFTS CLOSED" : "PENDING SHIFT CLOSURE"}
          </div>
        </div>
      </div>

      ${
        statusData.salesReconciliationMismatch
          ? `
        <div style="background: #fef2f2; border: 1px solid #b91c1c; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; color: #991b1b; font-size: 12px;">
          <strong>WARNING: RECONCILIATION MISMATCH DETECTED</strong><br/>
          Cash recorded across cashier shifts (${formatCurrency(statusData.shiftSalesSum)}) does not match cash sales on invoices (${formatCurrency(statusData.payments?.cash || 0)}). Review individual shift cash movements.
        </div>
      `
          : ""
      }

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

      <!-- Shifts Reconciliation Table -->
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase;">Cashier Shift Drawers & Variance</h4>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase;">
              <th style="padding: 6px 4px; text-align: left;">Cashier</th>
              <th style="padding: 6px 4px; text-align: center;">Shift Status</th>
              <th style="padding: 6px 4px; text-align: right;">Opening Float</th>
              <th style="padding: 6px 4px; text-align: right;">Cash Sales</th>
              <th style="padding: 6px 4px; text-align: right;">Safe Drops</th>
              <th style="padding: 6px 4px; text-align: right;">Expected Drawer</th>
              <th style="padding: 6px 4px; text-align: right;">Counted Cash</th>
              <th style="padding: 6px 4px; text-align: right;">Variance</th>
            </tr>
          </thead>
          <tbody>
            ${shiftsRows || `<tr><td colspan="8" style="padding: 8px; text-align: center; color: #888;">No shifts recorded for this date.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #f3f4f6; font-weight: 900; font-size: 11px; border-top: 2px solid #000;">
              <td colspan="5" style="padding: 8px 4px;">TOTAL DRAWER RECONCILIATION:</td>
              <td style="padding: 8px 4px; text-align: right;">${formatCurrency(statusData.totalExpectedDrawerCash)}</td>
              <td style="padding: 8px 4px; text-align: right;">${formatCurrency(statusData.totalActualCountedCash)}</td>
              <td style="padding: 8px 4px; text-align: right; color: ${statusData.totalVariance < 0 ? '#b91c1c' : '#047857'};">
                ${formatCurrency(statusData.totalVariance)}
              </td>
            </tr>
          </tfoot>
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
