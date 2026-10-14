// src/types/index.ts
// Comprehensive domain types for Shoe Shop POS & Business Management System (Phase 1 & Production)

export type UserRole = "SUPER_ADMIN" | "SHOP_MANAGER" | "CASHIER";

export type Gender = "MEN" | "WOMEN" | "UNISEX" | "KIDS";

export interface Shop {
  id: string; // "rightway" or "mega"
  slug: "rightway" | "mega";
  code: string; // "RW" or "MG"
  name: string; // "RightWay Shoes" or "Mega Shoes"
  address: string;
  phone: string;
  taxNumber?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  invoicePrefix: string; // "RW-INV" or "MG-INV"
  shiftPrefix: string;   // "RW-SFT" or "MG-SFT"
  repairPrefix: string;  // "RW-REP" or "MG-REP"
  active: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  allowedShopIds: string[]; // e.g. ["rightway"] or ["mega"] or ["rightway", "mega"] for SUPER_ADMIN
  active: boolean;
  mustChangePassword?: boolean;
  lastSignInAt?: number;
  discountCap?: number; // Maximum allowed % discount for this user
  cashRefundCap?: number; // Maximum allowed Rs. refund without approval
  canCreatePurchase?: boolean; // Granted to managers if enabled
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Color {
  id: string;
  name: string;
  hexCode?: string;
}

export interface ShoeSize {
  id: string;
  label: string; // e.g. "41", "42", "43", "US 9"
  gender: Gender;
}

export interface Product {
  id: string;
  name: string; // e.g. "Air Max Supreme"
  brandId: string;
  categoryId: string;
  gender: Gender;
  imagePath?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  colorId: string;
  sizeId: string;
  sku: string; // e.g. "RW-AIRMAX-BLK-42"
  barcode: string; // Unique barcode
  barcodeSource: "MANUFACTURER" | "INTERNAL";
  referenceCostPrice: number; // Stored separately in production; accessible only by SUPER_ADMIN
  sellingPrice: number;
  productNameCache: string;
  brandNameCache: string;
  colorNameCache: string;
  sizeLabelCache: string;
  active: boolean;
}

export interface VariantCost {
  variantId: string;
  referenceCostPrice: number;
  updatedAt: number;
  updatedBy: string;
}

export interface Inventory {
  id: string; // {shopId}_{variantId}
  shopId: string;
  variantId: string;
  productId: string;
  quantityOnHand: number;
  reorderLevel: number;
  lastMovementAt: number;
}

export type MovementType =
  | "PURCHASE_IN"
  | "SALE_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "DAMAGE"
  | "RETURN_IN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export type MovementDirection = "IN" | "OUT";

export interface StockMovement {
  id: string;
  shopId: string;
  variantId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  direction: MovementDirection;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  referenceType: "SALE" | "PURCHASE" | "ADJUSTMENT" | "RETURN" | "TRANSFER" | "REPAIR" | "STOCK_COUNT";
  referenceId: string;
  userId: string;
  createdAt: number;
}

export type StockCountStatus = "DRAFT" | "COUNTING" | "SUBMITTED" | "APPROVED" | "CANCELLED";

export interface StockCountLine {
  variantId: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number; // countedQuantity - expectedQuantity
  notes?: string;
}

export interface StockCount {
  id: string;
  countNumber: string; // e.g. "RW-CNT-000001"
  shopId: string;
  scope: "ALL" | "BRAND" | "CATEGORY";
  scopeFilter?: string;
  status: StockCountStatus;
  snapshotAt: number;
  initiatedBy: string;
  initiatedByName: string;
  submittedAt?: number | null;
  submittedBy?: string | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  lines: StockCountLine[];
  totalVarianceItems: number;
  notes?: string;
}

export type ShiftStatus = "OPEN" | "CLOSED";

export interface CashierShift {
  id: string; // {shopId}_{shiftNumber} or auto-ID
  shiftNumber: string; // e.g. "RW-SFT-000123"
  shopId: string;
  cashierId: string;
  cashierNameCache: string;
  openedAt: number;
  closedAt?: number | null;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  cashRefunds: number;
  repairCashIn: number;
  cashPayouts: number;
  cashPaidIn: number;
  expectedCash: number;
  actualCashCounted?: number;
  variance?: number; // actualCashCounted - expectedCash
  status: ShiftStatus;
  closingNotes?: string | null;
  supervisorOverrideId?: string | null;
}

export type CashMovementType = "PAID_IN" | "PAID_OUT" | "SAFE_DROP";

export interface CashMovement {
  id: string;
  shiftId: string;
  shopId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  authorizedBy: string;
  createdAt: number;
}

export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string; // e.g. "RW-INV-000001"
  shopId: string;
  cashierId: string;
  cashierNameCache: string;
  shiftId: string; // Mandatory active shift
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  payments: PaymentEntry[];
  amountReceived?: number;
  changeGiven?: number;
  returnStatus: "NONE" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";
  returnedAmount: number;
  status: "COMPLETED" | "CANCELLED";
  cancelledAt?: number;
  cancelledBy?: string;
  cancelReason?: string;
  idempotencyKey?: string;
  createdAt: number;
  saleDate: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  shopId: string;
  cashierId?: string;
  variantId: string;
  productId: string;
  quantity: number;
  returnedQuantity: number;
  unitSellingPrice: number;
  unitCostPrice: number; // Hidden from cashier/manager queries
  discount: number;
  lineTotal: number;
  variantDescriptionCache: string;
}

export type ReturnType = "RETURN_REFUND" | "SIZE_EXCHANGE";
export type RefundMethod = "CASH" | "ORIGINAL_CARD" | "STORE_CREDIT" | "EVEN_EXCHANGE";

export interface ReturnItem {
  variantId: string;
  quantity: number;
  unitPriceRefunded: number;
  condition: "NEW_RESELLABLE" | "DEFECTIVE";
  restocked: boolean;
  reason: "SIZE_FIT" | "DEFECT" | "CUSTOMER_CHOICE";
  variantDescriptionCache?: string;
}

export interface CustomerReturn {
  id: string;
  returnNumber: string; // e.g. "RW-RET-000045"
  shopId: string;
  originalSaleId: string;
  originalInvoiceNumber: string;
  cashierId: string;
  shiftId: string;
  type: ReturnType;
  items: ReturnItem[];
  subtotalRefund: number;
  exchangeNewSaleId?: string | null;
  netRefundAmount: number;
  refundMethod: RefundMethod;
  notes?: string;
  approvedBy?: string;
  idempotencyKey?: string;
  createdAt: number;
}

export type RepairStatus =
  | "RECEIVED"
  | "UNDER_REPAIR"
  | "READY_FOR_PICKUP"
  | "DELIVERED"
  | "CANCELLED";

export interface RepairStatusHistory {
  from: string;
  to: string;
  at: number;
  by: string;
  notes?: string;
}

export interface ShoeRepairOrder {
  id: string;
  repairNumber: string; // e.g. "RW-REP-000102"
  shopId: string;
  intakeCashierId: string;
  intakeShiftId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  shoeBrand: string;
  shoeModel: string;
  shoeSize: string;
  shoeColor: string;
  isStorePurchased: boolean;
  linkedSaleId?: string | null;
  issueDescription: string;
  photoUrls?: string[];
  estimatedCost: number;
  advancePaid: number;
  advancePaymentMethod?: PaymentMethod;
  finalCost: number;
  balanceDue: number;
  status: RepairStatus;
  receivedAt: number;
  promisedDate: number;
  completedAt?: number | null;
  deliveredAt?: number | null;
  deliveryCashierId?: string | null;
  deliveryShiftId?: string | null;
  deliveryPaymentMethod?: PaymentMethod | null;
  notes?: string;
  statusHistory: RepairStatusHistory[];
}

export type TransferStatus = "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

export interface StockTransferItem {
  variantId: string;
  productId: string;
  dispatchedQuantity: number;
  receivedQuantity: number;
  variantDescriptionCache: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // e.g. "TRF-000089"
  sourceShopId: string;
  destinationShopId: string;
  status: TransferStatus;
  items: StockTransferItem[];
  totalQuantity: number;
  dispatchedBy: string;
  dispatchedAt: number;
  receivedBy?: string | null;
  receivedAt?: number | null;
  discrepancyNotes?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  paymentTerms?: string;
  active: boolean;
  createdAt: number;
}

export interface PurchaseItem {
  variantId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  variantDescriptionCache: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string; // e.g. "PUR-00001"
  shopId: string;
  supplierId: string;
  supplierNameCache: string;
  invoiceDate: number;
  totalAmount: number;
  status: "RECEIVED" | "CANCELLED";
  items: PurchaseItem[];
  receivedBy: string;
  receivedAt: number;
  notes?: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  shopId: string;
  date: number;
  type: "PURCHASE" | "PAYMENT" | "ADJUSTMENT";
  referenceId: string;
  referenceNumber: string;
  debit: number; // payment reduces liability
  credit: number; // purchase increases liability
  balanceAfter: number;
  notes?: string;
  createdAt: number;
}

export type ChequeStatus = "PENDING" | "CLEARED" | "BOUNCED" | "CANCELLED";

export interface ChequeHistoryEntry {
  from: string;
  to: string;
  at: number;
  by: string;
  reason?: string;
}

export interface Cheque {
  id: string;
  chequeNumber: string;
  supplierId: string;
  supplierNameCache: string;
  shopId: string;
  bankName: string;
  amount: number;
  issueDate: number;
  dueDate: number;
  clearedDate?: number | null;
  status: ChequeStatus;
  referencePaymentId?: string;
  notes?: string;
  history?: ChequeHistoryEntry[];
  createdAt: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  shopId: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: "CASH" | "CHEQUE" | "BANK_TRANSFER";
  chequeId?: string;
  reference?: string;
  notes?: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmailCache: string;
  action: string;
  entityType: string;
  entityId: string;
  shopId?: string;
  before?: any;
  after?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}

export interface SystemSettings {
  returnWindowDays: number;
  returnInvoiceRequired: boolean;
  returnApprovalThreshold: number; // Above this Rs. amount requires manager approval
  cashierDiscountCap: number; // % limit (e.g. 0% or 5%)
  managerDiscountCap: number; // % limit (e.g. 15%)
  cashierRefundCap: number;   // Rs. limit
  shiftVarianceTolerance: number; // Rs. limit before manager approval
  sessionTimeoutMinutes: number; // Minutes before auto-lock
  receiptPrinterWidth: "80mm" | "58mm";
  labelSize: "50x30mm" | "50x25mm" | "40x30mm";
  barcodeFormat: "EAN13" | "CODE128";
  currencySymbol: string;
  timeZone: string; // "Asia/Colombo"
}

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "OUTLET_NOT_ALLOWED"
  | "PERMISSION_DENIED"
  | "SHIFT_REQUIRED"
  | "INSUFFICIENT_STOCK"
  | "RETURN_QTY_EXCEEDED"
  | "APPROVAL_REQUIRED"
  | "CHEQUE_INVALID_TRANSITION"
  | "TRANSFER_ALREADY_RECEIVED"
  | "VARIANCE_APPROVAL_REQUIRED"
  | "DUPLICATE_REQUEST"
  | "LAST_ADMIN"
  | "PASSWORD_TOO_WEAK"
  | "OFFLINE";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  OUTLET_NOT_ALLOWED: "This account is not set up for this outlet.",
  PERMISSION_DENIED: "You do not have permission to do this.",
  SHIFT_REQUIRED: "Open a shift to start selling.",
  INSUFFICIENT_STOCK: "Not enough stock at this outlet.",
  RETURN_QTY_EXCEEDED: "More pairs than were sold or still returnable.",
  APPROVAL_REQUIRED: "A manager must approve this.",
  CHEQUE_INVALID_TRANSITION: "This cheque cannot be changed to that status.",
  TRANSFER_ALREADY_RECEIVED: "This transfer has already been received.",
  VARIANCE_APPROVAL_REQUIRED: "The cash difference needs a manager's approval.",
  DUPLICATE_REQUEST: "Already done; showing the original result.",
  LAST_ADMIN: "At least one active Super Admin must remain.",
  PASSWORD_TOO_WEAK: "Choose a longer password (at least 10 characters).",
  OFFLINE: "You are offline. Selling is paused until the connection returns.",
};
