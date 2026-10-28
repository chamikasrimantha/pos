// src/lib/print-config.ts
// Centralized physical paper and label dimensions for thermal printers and office A4 sheets

export const PRINT_SIZES = {
  // Standard footwear box & apparel vector thermal sticker
  PRODUCT_LABEL: {
    widthMm: 50,
    heightMm: 30,
    unit: "mm",
    name: "50×30mm Thermal Sticker",
  },
  // Repair desk luggage tag & customer claim slip barcode tag
  REPAIR_TAG: {
    widthMm: 50,
    heightMm: 30,
    unit: "mm",
    name: "50×30mm Repair Tag",
  },
  // Counter thermal receipt roll
  RECEIPT_WIDTH: {
    widthMm: 80,
    unit: "mm",
    name: "80mm Thermal Receipt",
  },
  // Multi-label sticker sheet (A4, 3 columns x 8 rows = 24 labels per sheet)
  A4_LABEL_SHEET: {
    widthMm: 210,
    heightMm: 297,
    columns: 3,
    rows: 8,
    labelsPerPage: 24,
    labelWidthMm: 64,
    labelHeightMm: 33.9,
    name: "A4 Sticker Sheet (24 labels/page)",
  },
  // Executive A4 Audit and Day-End reports
  A4_REPORT: {
    widthMm: 210,
    heightMm: 297,
    unit: "mm",
    name: "A4 Portrait Report",
  },
} as const;
