// src/lib/firestore-service.ts
// Atomic Firestore operations & business logic engine for RightWay Shoes & Mega Shoes
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Shop,
  UserProfile,
  Category,
  Brand,
  Color,
  ShoeSize,
  Product,
  ProductVariant,
  Inventory,
  StockMovement,
  CashierShift,
  CashMovement,
  Sale,
  SaleItem,
  CustomerReturn,
  ShoeRepairOrder,
  StockTransfer,
  Supplier,
  Purchase,
  SupplierTransaction,
  Cheque,
  SupplierPayment,
  AuditLog,
  PaymentEntry,
  ReturnItem,
  StockTransferItem,
  PurchaseItem,
  RepairStatus,
  ChequeStatus,
  StockCount,
  StockCountLine,
  SystemSettings,
  ERROR_MESSAGES,
} from "@/types";
import {
  SEED_SHOPS,
  SEED_CATEGORIES,
  SEED_BRANDS,
  SEED_COLORS,
  SEED_SIZES,
  SEED_PRODUCTS,
  SEED_VARIANTS,
  SEED_INVENTORIES,
  SEED_SUPPLIERS,
  SEED_USERS,
  DEFAULT_SETTINGS,
} from "./seed-data";

// Helper for local state caching / fallback in browser
const LOCAL_STORAGE_KEY = "RIGHTWAY_MEGA_POS_STORE_V2";

interface LocalStoreState {
  shops: Shop[];
  users: UserProfile[];
  categories: Category[];
  brands: Brand[];
  colors: Color[];
  sizes: ShoeSize[];
  products: Product[];
  variants: ProductVariant[];
  inventory: Record<string, Inventory>;
  movements: StockMovement[];
  shifts: CashierShift[];
  cashMovements: CashMovement[];
  sales: Sale[];
  saleItems: SaleItem[];
  returns: CustomerReturn[];
  repairs: ShoeRepairOrder[];
  transfers: StockTransfer[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierTransactions: SupplierTransaction[];
  cheques: Cheque[];
  payments: SupplierPayment[];
  stockCounts: StockCount[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  counters: Record<string, number>;
}

function getInitialStore(): LocalStoreState {
  const invMap: Record<string, Inventory> = {};
  SEED_INVENTORIES.forEach((inv) => {
    invMap[inv.id] = { ...inv };
  });

  return {
    shops: [...SEED_SHOPS],
    users: [...SEED_USERS],
    categories: [...SEED_CATEGORIES],
    brands: [...SEED_BRANDS],
    colors: [...SEED_COLORS],
    sizes: [...SEED_SIZES],
    products: [...SEED_PRODUCTS],
    variants: [...SEED_VARIANTS],
    inventory: invMap,
    movements: [],
    shifts: [],
    cashMovements: [],
    sales: [],
    saleItems: [],
    returns: [],
    repairs: [],
    transfers: [],
    suppliers: [...SEED_SUPPLIERS],
    purchases: [],
    supplierTransactions: [],
    cheques: [],
    payments: [],
    stockCounts: [],
    auditLogs: [],
    settings: { ...DEFAULT_SETTINGS },
    counters: {
      "rightway_inv": 100,
      "mega_inv": 50,
      "rightway_sft": 10,
      "mega_sft": 5,
      "rightway_ret": 1,
      "mega_ret": 1,
      "rightway_rep": 20,
      "mega_rep": 10,
      "rightway_cnt": 1,
      "mega_cnt": 1,
      "transfer": 15,
      "purchase": 10,
    },
  };
}

function loadLocalStore(): LocalStoreState {
  if (typeof window === "undefined") return getInitialStore();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = getInitialStore();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Ensure all arrays & settings exist
    if (!parsed.stockCounts) parsed.stockCounts = [];
    if (!parsed.cashMovements) parsed.cashMovements = [];
    if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    return parsed;
  } catch (err) {
    console.warn("Failed to parse local POS store:", err);
    return getInitialStore();
  }
}

function saveLocalStore(state: LocalStoreState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save POS store to localStorage:", err);
  }
}

// ==========================================
// 1. DATA SEEDING & INITIALIZATION
// ==========================================
export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    const shopCol = collection(db, "shops");
    const snapshot = await getDocs(shopCol);
    if (snapshot.empty) {
      console.log("Seeding Firestore with initial dataset for RightWay and Mega Shoes...");
      const batch = writeBatch(db);

      SEED_SHOPS.forEach((s) => batch.set(doc(db, "shops", s.id), s));
      SEED_CATEGORIES.forEach((c) => batch.set(doc(db, "categories", c.id), c));
      SEED_BRANDS.forEach((b) => batch.set(doc(db, "brands", b.id), b));
      SEED_COLORS.forEach((col) => batch.set(doc(db, "colors", col.id), col));
      SEED_SIZES.forEach((sz) => batch.set(doc(db, "sizes", sz.id), sz));
      SEED_PRODUCTS.forEach((p) => batch.set(doc(db, "products", p.id), p));
      SEED_VARIANTS.forEach((v) => batch.set(doc(db, "productVariants", v.id), v));
      SEED_INVENTORIES.forEach((inv) => batch.set(doc(db, "inventory", inv.id), inv));
      SEED_SUPPLIERS.forEach((sup) => batch.set(doc(db, "suppliers", sup.id), sup));
      SEED_USERS.forEach((u) => batch.set(doc(db, "users", u.uid), u));
      batch.set(doc(db, "settings", "global"), DEFAULT_SETTINGS);

      await batch.commit();
      console.log("Firestore successfully seeded!");
    }
  } catch (err) {
    console.warn("Firestore remote seed skipped (using local sync engine):", err);
  }
}

// ==========================================
// 2. COUNTERS & SEQUENTIAL NUMBER GENERATOR
// ==========================================
function getNextSequentialNumber(prefix: string, key: string): string {
  const store = loadLocalStore();
  const current = (store.counters[key] || 0) + 1;
  store.counters[key] = current;
  saveLocalStore(store);
  return `${prefix}-${String(current).padStart(6, "0")}`;
}

// ==========================================
// 3. MASTER DATA QUERIES
// ==========================================
export function getShops(): Shop[] {
  return loadLocalStore().shops;
}

export function getUsers(): UserProfile[] {
  return loadLocalStore().users;
}

export function getCategories(): Category[] {
  return loadLocalStore().categories;
}

export function getBrands(): Brand[] {
  return loadLocalStore().brands;
}

export function getColors(): Color[] {
  return loadLocalStore().colors;
}

export function getSizes(): ShoeSize[] {
  return loadLocalStore().sizes;
}

export function getProducts(): Product[] {
  return loadLocalStore().products;
}

export function getVariants(): ProductVariant[] {
  return loadLocalStore().variants;
}

export function getSuppliers(): Supplier[] {
  return loadLocalStore().suppliers;
}

export function getInventoryForShop(shopId: string): Inventory[] {
  const store = loadLocalStore();
  return Object.values(store.inventory).filter((i) => i.shopId === shopId);
}

export function getVariantStock(shopId: string, variantId: string): number {
  const store = loadLocalStore();
  const key = `${shopId}_${variantId}`;
  return store.inventory[key]?.quantityOnHand || 0;
}

export function getSystemSettings(): SystemSettings {
  return loadLocalStore().settings;
}

export async function updateSystemSettings(
  newSettings: Partial<SystemSettings>,
  updatedBy: string
): Promise<SystemSettings> {
  const store = loadLocalStore();
  const prev = { ...store.settings };
  store.settings = { ...store.settings, ...newSettings };

  logAuditAction(store, {
    userId: updatedBy,
    userEmailCache: "Admin",
    action: "SETTINGS_UPDATE",
    entityType: "settings",
    entityId: "global",
    before: prev,
    after: store.settings,
    reason: "Updated system settings",
  });

  saveLocalStore(store);
  try {
    await updateDoc(doc(db, "settings", "global"), store.settings);
  } catch (e) {
    console.warn("Firestore sync settings error:", e);
  }
  return store.settings;
}

// Cost price segregation (Section 5.5)
export function getVariantCostPrice(variantId: string, role: string): number | null {
  if (role !== "SUPER_ADMIN") return null;
  const store = loadLocalStore();
  const variant = store.variants.find((v) => v.id === variantId);
  return variant ? variant.referenceCostPrice : null;
}

// ==========================================
// 4. CASHIER SHIFTS MANAGEMENT
// ==========================================
export function getActiveShift(shopId: string, cashierId: string): CashierShift | null {
  const store = loadLocalStore();
  return (
    store.shifts.find(
      (s) => s.shopId === shopId && s.cashierId === cashierId && s.status === "OPEN"
    ) || null
  );
}

export function getShiftHistory(shopId: string): CashierShift[] {
  const store = loadLocalStore();
  return store.shifts.filter((s) => s.shopId === shopId).sort((a, b) => b.openedAt - a.openedAt);
}

export async function openCashierShift(params: {
  shopId: string;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
}): Promise<CashierShift> {
  const store = loadLocalStore();
  const existing = store.shifts.find(
    (s) => s.shopId === params.shopId && s.cashierId === params.cashierId && s.status === "OPEN"
  );
  if (existing) {
    throw new Error(`You already have an active open shift (#${existing.shiftNumber}).`);
  }

  const shop = store.shops.find((s) => s.id === params.shopId);
  const shiftPrefix = shop?.shiftPrefix || (params.shopId === "rightway" ? "RW-SFT" : "MG-SFT");
  const shiftNumber = getNextSequentialNumber(shiftPrefix, `${params.shopId}_sft`);
  const shiftId = `sft_${Date.now()}`;

  const newShift: CashierShift = {
    id: shiftId,
    shiftNumber,
    shopId: params.shopId,
    cashierId: params.cashierId,
    cashierNameCache: params.cashierName,
    openedAt: Date.now(),
    closedAt: null,
    openingFloat: params.openingFloat,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    cashRefunds: 0,
    repairCashIn: 0,
    cashPayouts: 0,
    cashPaidIn: 0,
    expectedCash: params.openingFloat,
    status: "OPEN",
  };

  store.shifts.push(newShift);
  logAuditAction(store, {
    userId: params.cashierId,
    userEmailCache: params.cashierName,
    action: "SHIFT_OPEN",
    entityType: "cashierShifts",
    entityId: shiftId,
    shopId: params.shopId,
    after: newShift,
    reason: `Shift opened with float of Rs. ${params.openingFloat}`,
  });
  saveLocalStore(store);

  try {
    await setDoc(doc(db, "cashierShifts", shiftId), newShift);
  } catch (e) {
    console.warn("Firestore sync shift error:", e);
  }

  return newShift;
}

export async function closeCashierShift(params: {
  shiftId: string;
  actualCashCounted: number;
  closingNotes?: string;
  supervisorOverrideId?: string;
}): Promise<CashierShift> {
  const store = loadLocalStore();
  const shift = store.shifts.find((s) => s.id === params.shiftId);
  if (!shift) throw new Error("Shift not found");
  if (shift.status === "CLOSED") throw new Error("Shift is already closed");

  const expectedCash =
    shift.openingFloat +
    shift.cashSales +
    (shift.repairCashIn || 0) +
    (shift.cashPaidIn || 0) -
    (shift.cashRefunds || 0) -
    (shift.cashPayouts || 0);

  const variance = params.actualCashCounted - expectedCash;

  shift.status = "CLOSED";
  shift.closedAt = Date.now();
  shift.expectedCash = expectedCash;
  shift.actualCashCounted = params.actualCashCounted;
  shift.variance = variance;
  shift.closingNotes = params.closingNotes || null;
  shift.supervisorOverrideId = params.supervisorOverrideId || null;

  logAuditAction(store, {
    userId: shift.cashierId,
    userEmailCache: shift.cashierNameCache,
    action: "SHIFT_CLOSE",
    entityType: "cashierShifts",
    entityId: shift.id,
    shopId: shift.shopId,
    after: shift,
    reason: `Shift closed. Expected: Rs. ${expectedCash}, Counted: Rs. ${params.actualCashCounted}, Variance: Rs. ${variance}`,
  });
  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "cashierShifts", shift.id), {
      status: "CLOSED",
      closedAt: shift.closedAt,
      expectedCash,
      actualCashCounted: params.actualCashCounted,
      variance,
      closingNotes: params.closingNotes || null,
      supervisorOverrideId: params.supervisorOverrideId || null,
    });
  } catch (e) {
    console.warn("Firestore sync shift close error:", e);
  }

  return shift;
}

export async function recordCashMovement(params: {
  shiftId: string;
  shopId: string;
  type: "PAID_IN" | "PAID_OUT" | "SAFE_DROP";
  amount: number;
  reason: string;
  authorizedBy: string;
}): Promise<CashMovement> {
  const store = loadLocalStore();
  const shift = store.shifts.find((s) => s.id === params.shiftId && s.status === "OPEN");
  if (!shift) throw new Error(ERROR_MESSAGES.SHIFT_REQUIRED);

  const movementId = `cm_${Date.now()}`;
  const movement: CashMovement = {
    id: movementId,
    shiftId: params.shiftId,
    shopId: params.shopId,
    type: params.type,
    amount: params.amount,
    reason: params.reason,
    authorizedBy: params.authorizedBy,
    createdAt: Date.now(),
  };

  if (params.type === "PAID_IN") {
    shift.cashPaidIn = (shift.cashPaidIn || 0) + params.amount;
  } else {
    shift.cashPayouts = (shift.cashPayouts || 0) + params.amount;
  }

  store.cashMovements.push(movement);
  logAuditAction(store, {
    userId: params.authorizedBy,
    userEmailCache: "Manager",
    action: `CASH_${params.type}`,
    entityType: "cashMovements",
    entityId: movementId,
    shopId: params.shopId,
    after: movement,
    reason: params.reason,
  });

  saveLocalStore(store);
  return movement;
}

export function getCashMovementsForShift(shiftId: string): CashMovement[] {
  const store = loadLocalStore();
  return store.cashMovements.filter((m) => m.shiftId === shiftId);
}

// ==========================================
// 5. ATOMIC POS SALE COMPLETION
// ==========================================
export async function completeSale(params: {
  shopId: string;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  customerName?: string;
  customerPhone?: string;
  items: {
    variant: ProductVariant;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  payments: PaymentEntry[];
  amountReceived?: number;
  changeGiven?: number;
  idempotencyKey?: string;
}): Promise<{ sale: Sale; items: SaleItem[] }> {
  const store = loadLocalStore();

  // 1. Idempotency Check
  if (params.idempotencyKey) {
    const existingSale = store.sales.find((s) => s.idempotencyKey === params.idempotencyKey);
    if (existingSale) {
      const items = store.saleItems.filter((i) => i.saleId === existingSale.id);
      return { sale: existingSale, items };
    }
  }

  // 2. Verify active shift
  const shift = store.shifts.find((s) => s.id === params.shiftId && s.status === "OPEN");
  if (!shift) {
    throw new Error(ERROR_MESSAGES.SHIFT_REQUIRED);
  }

  // 3. Validate stock sufficiency for all cart items
  for (const item of params.items) {
    const invKey = `${params.shopId}_${item.variant.id}`;
    const currentOnHand = store.inventory[invKey]?.quantityOnHand || 0;
    if (currentOnHand < item.quantity) {
      throw new Error(
        `Insufficient stock for "${item.variant.productNameCache} (${item.variant.sizeLabelCache})". Available: ${currentOnHand}, Requested: ${item.quantity}`
      );
    }
  }

  // 4. Generate sequential invoice number
  const shop = store.shops.find((s) => s.id === params.shopId);
  const invPrefix = shop?.invoicePrefix || (params.shopId === "rightway" ? "RW-INV" : "MG-INV");
  const invoiceNumber = getNextSequentialNumber(invPrefix, `${params.shopId}_inv`);
  const saleId = `sale_${Date.now()}`;

  const createdSale: Sale = {
    id: saleId,
    invoiceNumber,
    shopId: params.shopId,
    cashierId: params.cashierId,
    cashierNameCache: params.cashierName,
    shiftId: params.shiftId,
    customerName: params.customerName || undefined,
    customerPhone: params.customerPhone || undefined,
    subtotal: params.subtotal,
    discount: params.discount,
    taxAmount: params.taxAmount,
    total: params.total,
    payments: params.payments,
    amountReceived: params.amountReceived,
    changeGiven: params.changeGiven,
    returnStatus: "NONE",
    returnedAmount: 0,
    status: "COMPLETED",
    idempotencyKey: params.idempotencyKey,
    createdAt: Date.now(),
    saleDate: Date.now(),
  };

  const createdItems: SaleItem[] = [];

  // 5. Atomic inventory decrement & movement logging
  for (const item of params.items) {
    const invKey = `${params.shopId}_${item.variant.id}`;
    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty - item.quantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    const saleItemId = `si_${Date.now()}_${item.variant.id}`;
    const sItem: SaleItem = {
      id: saleItemId,
      saleId,
      shopId: params.shopId,
      cashierId: params.cashierId,
      variantId: item.variant.id,
      productId: item.variant.productId,
      quantity: item.quantity,
      returnedQuantity: 0,
      unitSellingPrice: item.unitPrice,
      unitCostPrice: item.variant.referenceCostPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      variantDescriptionCache: `${item.variant.productNameCache} - ${item.variant.colorNameCache} - ${item.variant.sizeLabelCache}`,
    };
    createdItems.push(sItem);

    const movement: StockMovement = {
      id: `mvt_${Date.now()}_${item.variant.id}`,
      shopId: params.shopId,
      variantId: item.variant.id,
      productId: item.variant.productId,
      type: "SALE_OUT",
      quantity: item.quantity,
      direction: "OUT",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      referenceType: "SALE",
      referenceId: saleId,
      userId: params.cashierId,
      createdAt: Date.now(),
    };
    store.movements.push(movement);
  }

  // 6. Update Cashier Shift drawer accumulation
  for (const pay of params.payments) {
    if (pay.method === "CASH") {
      shift.cashSales += pay.amount;
    } else if (pay.method === "CARD") {
      shift.cardSales += pay.amount;
    } else if (pay.method === "BANK_TRANSFER") {
      shift.transferSales += pay.amount;
    }
  }

  store.sales.push(createdSale);
  store.saleItems.push(...createdItems);

  logAuditAction(store, {
    userId: params.cashierId,
    userEmailCache: params.cashierName,
    action: "SALE_CREATE",
    entityType: "sales",
    entityId: saleId,
    shopId: params.shopId,
    after: { invoiceNumber, total: params.total, itemsCount: createdItems.length },
    reason: `Completed Sale ${invoiceNumber}`,
  });

  saveLocalStore(store);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "sales", saleId), createdSale);
    createdItems.forEach((it) => batch.set(doc(db, "saleItems", it.id), it));
    await batch.commit();
  } catch (e) {
    console.warn("Firestore sync sale error:", e);
  }

  return { sale: createdSale, items: createdItems };
}

// ==========================================
// 6. CUSTOMER RETURNS & SIZE EXCHANGES
// ==========================================
export function findSaleByInvoice(invoiceNumber: string): { sale: Sale; items: SaleItem[] } | null {
  const store = loadLocalStore();
  const sale = store.sales.find((s) => s.invoiceNumber.trim().toUpperCase() === invoiceNumber.trim().toUpperCase());
  if (!sale) return null;
  const items = store.saleItems.filter((i) => i.saleId === sale.id);
  return { sale, items };
}

export async function processCustomerReturn(params: {
  shopId: string;
  originalSale: Sale;
  items: ReturnItem[];
  refundMethod: "CASH" | "ORIGINAL_CARD" | "STORE_CREDIT" | "EVEN_EXCHANGE";
  cashierId: string;
  shiftId: string;
  notes?: string;
  approvedBy?: string;
  exchangeReplacement?: {
    variant: ProductVariant;
    quantity: number;
    price: number;
  };
}): Promise<CustomerReturn> {
  const store = loadLocalStore();

  const shift = store.shifts.find((s) => s.id === params.shiftId && s.status === "OPEN");
  if (!shift) {
    throw new Error(ERROR_MESSAGES.SHIFT_REQUIRED);
  }

  const retPrefix = params.shopId === "rightway" ? "RW-RET" : "MG-RET";
  const returnNumber = getNextSequentialNumber(retPrefix, `${params.shopId}_ret`);
  const returnId = `ret_${Date.now()}`;

  const subtotalRefund = params.items.reduce((sum, it) => sum + it.unitPriceRefunded * it.quantity, 0);

  // 1. Process returned items
  for (const it of params.items) {
    const invKey = `${params.shopId}_${it.variantId}`;
    if (!store.inventory[invKey]) {
      store.inventory[invKey] = {
        id: invKey,
        shopId: params.shopId,
        variantId: it.variantId,
        productId: "",
        quantityOnHand: 0,
        reorderLevel: 2,
        lastMovementAt: Date.now(),
      };
    }
    const beforeQty = store.inventory[invKey].quantityOnHand;

    if (it.condition === "NEW_RESELLABLE" && it.restocked) {
      // Re-stock into inventory
      const afterQty = beforeQty + it.quantity;
      store.inventory[invKey].quantityOnHand = afterQty;
      store.inventory[invKey].lastMovementAt = Date.now();

      store.movements.push({
        id: `mvt_${Date.now()}_ret_${it.variantId}`,
        shopId: params.shopId,
        variantId: it.variantId,
        productId: store.inventory[invKey].productId,
        type: "RETURN_IN",
        quantity: it.quantity,
        direction: "IN",
        quantityBefore: beforeQty,
        quantityAfter: afterQty,
        reason: it.reason,
        referenceType: "RETURN",
        referenceId: returnId,
        userId: params.cashierId,
        createdAt: Date.now(),
      });
    } else {
      // Defective return: Section 11 Check #2 -> quantityOnHand MUST NOT CHANGE!
      store.movements.push({
        id: `mvt_${Date.now()}_dmg_${it.variantId}`,
        shopId: params.shopId,
        variantId: it.variantId,
        productId: store.inventory[invKey].productId,
        type: "DAMAGE",
        quantity: it.quantity,
        direction: "OUT",
        quantityBefore: beforeQty,
        quantityAfter: beforeQty, // Intentionally unmodified
        reason: `Defective customer return: ${it.reason}`,
        referenceType: "RETURN",
        referenceId: returnId,
        userId: params.cashierId,
        createdAt: Date.now(),
      });
    }

    // Update original sale item returned count
    const saleItem = store.saleItems.find((si) => si.saleId === params.originalSale.id && si.variantId === it.variantId);
    if (saleItem) {
      saleItem.returnedQuantity += it.quantity;
    }
  }

  // 2. Handle financial settlement
  let exchangeSaleId: string | null = null;
  let netRefund = subtotalRefund;

  if (params.exchangeReplacement) {
    const rep = params.exchangeReplacement;
    const invKey = `${params.shopId}_${rep.variant.id}`;
    const beforeQty = store.inventory[invKey]?.quantityOnHand || 0;
    if (beforeQty < rep.quantity) {
      throw new Error(`Replacement variant "${rep.variant.productNameCache}" is out of stock in this branch.`);
    }
    store.inventory[invKey].quantityOnHand = beforeQty - rep.quantity;

    store.movements.push({
      id: `mvt_${Date.now()}_exc_${rep.variant.id}`,
      shopId: params.shopId,
      variantId: rep.variant.id,
      productId: rep.variant.productId,
      type: "SALE_OUT",
      quantity: rep.quantity,
      direction: "OUT",
      quantityBefore: beforeQty,
      quantityAfter: beforeQty - rep.quantity,
      reason: `Size exchange replacement for Return ${returnNumber}`,
      referenceType: "SALE",
      referenceId: returnId,
      userId: params.cashierId,
      createdAt: Date.now(),
    });

    const replacementTotal = rep.price * rep.quantity;
    if (replacementTotal > subtotalRefund) {
      // Customer pays the difference
      const diff = replacementTotal - subtotalRefund;
      shift.cashSales += diff;
      netRefund = 0;
    } else {
      // Refund remaining difference
      netRefund = subtotalRefund - replacementTotal;
      if (params.refundMethod === "CASH" && netRefund > 0) {
        shift.cashRefunds += netRefund;
      }
    }
    exchangeSaleId = `exc_sale_${Date.now()}`;
  } else if (params.refundMethod === "CASH") {
    shift.cashRefunds += netRefund;
  }

  // Update original sale returnStatus
  const origSale = store.sales.find((s) => s.id === params.originalSale.id);
  if (origSale) {
    origSale.returnedAmount = (origSale.returnedAmount || 0) + subtotalRefund;
    origSale.returnStatus = origSale.returnedAmount >= origSale.total ? "FULLY_RETURNED" : "PARTIALLY_RETURNED";
  }

  const returnRecord: CustomerReturn = {
    id: returnId,
    returnNumber,
    shopId: params.shopId,
    originalSaleId: params.originalSale.id,
    originalInvoiceNumber: params.originalSale.invoiceNumber,
    cashierId: params.cashierId,
    shiftId: params.shiftId,
    type: params.exchangeReplacement ? "SIZE_EXCHANGE" : "RETURN_REFUND",
    items: params.items,
    subtotalRefund,
    exchangeNewSaleId: exchangeSaleId,
    netRefundAmount: netRefund,
    refundMethod: params.refundMethod,
    notes: params.notes,
    approvedBy: params.approvedBy,
    createdAt: Date.now(),
  };

  store.returns.push(returnRecord);
  logAuditAction(store, {
    userId: params.cashierId,
    userEmailCache: shift.cashierNameCache,
    action: "RETURN_CREATE",
    entityType: "returns",
    entityId: returnId,
    shopId: params.shopId,
    after: returnRecord,
    reason: `Processed return ${returnNumber} for invoice ${params.originalSale.invoiceNumber}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "returns", returnId), returnRecord);
  } catch (e) {
    console.warn("Firestore sync return error:", e);
  }

  return returnRecord;
}

// ==========================================
// 7. SHOE REPAIR MANAGEMENT & INVOICING
// ==========================================
export function getRepairOrders(shopId: string): ShoeRepairOrder[] {
  const store = loadLocalStore();
  return store.repairs.filter((r) => r.shopId === shopId).sort((a, b) => b.receivedAt - a.receivedAt);
}

export async function createRepairOrder(params: {
  shopId: string;
  intakeCashierId: string;
  intakeShiftId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  shoeBrand: string;
  shoeModel: string;
  shoeSize: string;
  shoeColor: string;
  isStorePurchased: boolean;
  issueDescription: string;
  estimatedCost: number;
  advancePaid: number;
  advancePaymentMethod?: "CASH" | "CARD" | "BANK_TRANSFER";
  promisedDate: number;
  notes?: string;
}): Promise<ShoeRepairOrder> {
  const store = loadLocalStore();

  const shift = store.shifts.find((s) => s.id === params.intakeShiftId && s.status === "OPEN");
  if (params.advancePaid > 0 && !shift) {
    throw new Error(ERROR_MESSAGES.SHIFT_REQUIRED);
  }

  const shop = store.shops.find((s) => s.id === params.shopId);
  const repPrefix = shop?.repairPrefix || (params.shopId === "rightway" ? "RW-REP" : "MG-REP");
  const repairNumber = getNextSequentialNumber(repPrefix, `${params.shopId}_rep`);
  const repairId = `rep_${Date.now()}`;

  const balanceDue = Math.max(0, params.estimatedCost - params.advancePaid);

  const repair: ShoeRepairOrder = {
    id: repairId,
    repairNumber,
    shopId: params.shopId,
    intakeCashierId: params.intakeCashierId,
    intakeShiftId: params.intakeShiftId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerAddress: params.customerAddress || null,
    shoeBrand: params.shoeBrand,
    shoeModel: params.shoeModel,
    shoeSize: params.shoeSize,
    shoeColor: params.shoeColor,
    isStorePurchased: params.isStorePurchased,
    issueDescription: params.issueDescription,
    estimatedCost: params.estimatedCost,
    advancePaid: params.advancePaid,
    advancePaymentMethod: params.advancePaymentMethod,
    finalCost: params.estimatedCost,
    balanceDue,
    status: "RECEIVED",
    receivedAt: Date.now(),
    promisedDate: params.promisedDate,
    notes: params.notes,
    statusHistory: [
      {
        from: "NEW",
        to: "RECEIVED",
        at: Date.now(),
        by: params.intakeCashierId,
        notes: "Shoe received at counter",
      },
    ],
  };

  if (params.advancePaid > 0 && params.advancePaymentMethod === "CASH" && shift) {
    shift.repairCashIn = (shift.repairCashIn || 0) + params.advancePaid;
  }

  store.repairs.push(repair);
  logAuditAction(store, {
    userId: params.intakeCashierId,
    userEmailCache: shift?.cashierNameCache || "Cashier",
    action: "REPAIR_CREATE",
    entityType: "repairOrders",
    entityId: repairId,
    shopId: params.shopId,
    after: repair,
    reason: `Repair job ${repairNumber} created for ${params.customerName}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "repairOrders", repairId), repair);
  } catch (e) {
    console.warn("Firestore sync repair error:", e);
  }

  return repair;
}

export async function updateRepairStatus(params: {
  repairId: string;
  newStatus: RepairStatus;
  userId: string;
  notes?: string;
}): Promise<ShoeRepairOrder> {
  const store = loadLocalStore();
  const repair = store.repairs.find((r) => r.id === params.repairId);
  if (!repair) throw new Error("Repair order not found");

  const prev = repair.status;
  repair.status = params.newStatus;
  if (params.newStatus === "READY_FOR_PICKUP") {
    repair.completedAt = Date.now();
  }

  repair.statusHistory.push({
    from: prev,
    to: params.newStatus,
    at: Date.now(),
    by: params.userId,
    notes: params.notes,
  });

  logAuditAction(store, {
    userId: params.userId,
    userEmailCache: "Staff",
    action: "REPAIR_STATUS_CHANGE",
    entityType: "repairOrders",
    entityId: repair.id,
    shopId: repair.shopId,
    before: { status: prev },
    after: { status: params.newStatus },
    reason: params.notes || `Moved from ${prev} to ${params.newStatus}`,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "repairOrders", repair.id), {
      status: params.newStatus,
      completedAt: repair.completedAt || null,
      statusHistory: repair.statusHistory,
    });
  } catch (e) {
    console.warn("Firestore sync repair status error:", e);
  }

  return repair;
}

export async function deliverRepairOrder(params: {
  repairId: string;
  finalCost: number;
  deliveryCashierId: string;
  deliveryShiftId: string;
  deliveryPaymentMethod: "CASH" | "CARD" | "BANK_TRANSFER";
}): Promise<ShoeRepairOrder> {
  const store = loadLocalStore();
  const repair = store.repairs.find((r) => r.id === params.repairId);
  if (!repair) throw new Error("Repair order not found");

  const shift = store.shifts.find((s) => s.id === params.deliveryShiftId && s.status === "OPEN");
  if (!shift) {
    throw new Error(ERROR_MESSAGES.SHIFT_REQUIRED);
  }

  const balanceToCollect = Math.max(0, params.finalCost - repair.advancePaid);

  repair.finalCost = params.finalCost;
  repair.balanceDue = 0;
  repair.status = "DELIVERED";
  repair.deliveredAt = Date.now();
  repair.deliveryCashierId = params.deliveryCashierId;
  repair.deliveryShiftId = params.deliveryShiftId;
  repair.deliveryPaymentMethod = params.deliveryPaymentMethod;

  repair.statusHistory.push({
    from: "READY_FOR_PICKUP",
    to: "DELIVERED",
    at: Date.now(),
    by: params.deliveryCashierId,
    notes: `Delivered to customer. Collected Rs. ${balanceToCollect} via ${params.deliveryPaymentMethod}`,
  });

  if (balanceToCollect > 0 && params.deliveryPaymentMethod === "CASH") {
    shift.repairCashIn = (shift.repairCashIn || 0) + balanceToCollect;
  }

  logAuditAction(store, {
    userId: params.deliveryCashierId,
    userEmailCache: shift.cashierNameCache,
    action: "REPAIR_DELIVER",
    entityType: "repairOrders",
    entityId: repair.id,
    shopId: repair.shopId,
    after: repair,
    reason: `Delivered repair ${repair.repairNumber}. Balance settled: Rs. ${balanceToCollect}`,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "repairOrders", repair.id), {
      status: "DELIVERED",
      finalCost: params.finalCost,
      balanceDue: 0,
      deliveredAt: repair.deliveredAt,
      deliveryCashierId: params.deliveryCashierId,
      deliveryShiftId: params.deliveryShiftId,
      deliveryPaymentMethod: params.deliveryPaymentMethod,
      statusHistory: repair.statusHistory,
    });
  } catch (e) {
    console.warn("Firestore sync repair delivery error:", e);
  }

  return repair;
}

// ==========================================
// 8. INTER-SHOP STOCK TRANSFERS
// ==========================================
export function getTransfers(): StockTransfer[] {
  const store = loadLocalStore();
  return store.transfers.sort((a, b) => b.dispatchedAt - a.dispatchedAt);
}

export async function dispatchTransfer(params: {
  sourceShopId: string;
  destinationShopId: string;
  items: { variant: ProductVariant; quantity: number }[];
  dispatchedBy: string;
}): Promise<StockTransfer> {
  const store = loadLocalStore();

  for (const it of params.items) {
    const invKey = `${params.sourceShopId}_${it.variant.id}`;
    const onHand = store.inventory[invKey]?.quantityOnHand || 0;
    if (onHand < it.quantity) {
      throw new Error(`Insufficient stock for ${it.variant.productNameCache} at origin branch. (Available: ${onHand})`);
    }
  }

  const transferNumber = getNextSequentialNumber("TRF", "transfer");
  const transferId = `trf_${Date.now()}`;

  const transferItems: StockTransferItem[] = [];
  let totalQty = 0;

  for (const it of params.items) {
    const invKey = `${params.sourceShopId}_${it.variant.id}`;
    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty - it.quantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    totalQty += it.quantity;
    transferItems.push({
      variantId: it.variant.id,
      productId: it.variant.productId,
      dispatchedQuantity: it.quantity,
      receivedQuantity: 0,
      variantDescriptionCache: `${it.variant.productNameCache} - ${it.variant.colorNameCache} - ${it.variant.sizeLabelCache}`,
    });

    store.movements.push({
      id: `mvt_${Date.now()}_trf_out_${it.variant.id}`,
      shopId: params.sourceShopId,
      variantId: it.variant.id,
      productId: it.variant.productId,
      type: "TRANSFER_OUT",
      quantity: it.quantity,
      direction: "OUT",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      referenceType: "TRANSFER",
      referenceId: transferId,
      userId: params.dispatchedBy,
      createdAt: Date.now(),
    });
  }

  const transfer: StockTransfer = {
    id: transferId,
    transferNumber,
    sourceShopId: params.sourceShopId,
    destinationShopId: params.destinationShopId,
    status: "IN_TRANSIT",
    items: transferItems,
    totalQuantity: totalQty,
    dispatchedBy: params.dispatchedBy,
    dispatchedAt: Date.now(),
    receivedBy: null,
    receivedAt: null,
  };

  store.transfers.push(transfer);
  logAuditAction(store, {
    userId: params.dispatchedBy,
    userEmailCache: "Dispatcher",
    action: "TRANSFER_DISPATCH",
    entityType: "stockTransfers",
    entityId: transferId,
    shopId: params.sourceShopId,
    after: transfer,
    reason: `Dispatched ${totalQty} pairs to branch ${params.destinationShopId}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "stockTransfers", transferId), transfer);
  } catch (e) {
    console.warn("Firestore sync transfer dispatch error:", e);
  }

  return transfer;
}

export async function receiveTransfer(params: {
  transferId: string;
  receivedBy: string;
  discrepancyNotes?: string;
}): Promise<StockTransfer> {
  const store = loadLocalStore();
  const transfer = store.transfers.find((t) => t.id === params.transferId);
  if (!transfer) throw new Error("Transfer record not found");
  if (transfer.status === "RECEIVED") throw new Error(ERROR_MESSAGES.TRANSFER_ALREADY_RECEIVED);

  for (const it of transfer.items) {
    const invKey = `${transfer.destinationShopId}_${it.variantId}`;
    if (!store.inventory[invKey]) {
      store.inventory[invKey] = {
        id: invKey,
        shopId: transfer.destinationShopId,
        variantId: it.variantId,
        productId: it.productId,
        quantityOnHand: 0,
        reorderLevel: 2,
        lastMovementAt: Date.now(),
      };
    }

    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty + it.dispatchedQuantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();
    it.receivedQuantity = it.dispatchedQuantity;

    store.movements.push({
      id: `mvt_${Date.now()}_trf_in_${it.variantId}`,
      shopId: transfer.destinationShopId,
      variantId: it.variantId,
      productId: it.productId,
      type: "TRANSFER_IN",
      quantity: it.dispatchedQuantity,
      direction: "IN",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      referenceType: "TRANSFER",
      referenceId: transfer.id,
      userId: params.receivedBy,
      createdAt: Date.now(),
    });
  }

  transfer.status = "RECEIVED";
  transfer.receivedBy = params.receivedBy;
  transfer.receivedAt = Date.now();
  transfer.discrepancyNotes = params.discrepancyNotes || null;

  logAuditAction(store, {
    userId: params.receivedBy,
    userEmailCache: "Receiver",
    action: "TRANSFER_RECEIVE",
    entityType: "stockTransfers",
    entityId: transfer.id,
    shopId: transfer.destinationShopId,
    after: transfer,
    reason: `Received transfer ${transfer.transferNumber}`,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "stockTransfers", transfer.id), {
      status: "RECEIVED",
      receivedBy: params.receivedBy,
      receivedAt: transfer.receivedAt,
      discrepancyNotes: transfer.discrepancyNotes,
      items: transfer.items,
    });
  } catch (e) {
    console.warn("Firestore sync transfer receive error:", e);
  }

  return transfer;
}

// ==========================================
// 9. PHYSICAL STOCK COUNT MODULE (Section 6.3)
// ==========================================
export function getStockCounts(shopId: string): StockCount[] {
  const store = loadLocalStore();
  return store.stockCounts.filter((c) => c.shopId === shopId).sort((a, b) => b.snapshotAt - a.snapshotAt);
}

export async function startStockCount(params: {
  shopId: string;
  scope: "ALL" | "BRAND" | "CATEGORY";
  scopeFilter?: string;
  initiatedBy: string;
  initiatedByName: string;
}): Promise<StockCount> {
  const store = loadLocalStore();
  const shop = store.shops.find((s) => s.id === params.shopId);
  const cntPrefix = shop?.code ? `${shop.code}-CNT` : "CNT";
  const countNumber = getNextSequentialNumber(cntPrefix, `${params.shopId}_cnt`);
  const countId = `cnt_${Date.now()}`;

  // Filter variants by scope
  let targetedVariants = store.variants.filter((v) => v.active);
  if (params.scope === "BRAND" && params.scopeFilter) {
    targetedVariants = targetedVariants.filter((v) => {
      const prod = store.products.find((p) => p.id === v.productId);
      return prod?.brandId === params.scopeFilter;
    });
  } else if (params.scope === "CATEGORY" && params.scopeFilter) {
    targetedVariants = targetedVariants.filter((v) => {
      const prod = store.products.find((p) => p.id === v.productId);
      return prod?.categoryId === params.scopeFilter;
    });
  }

  const lines: StockCountLine[] = targetedVariants.map((v) => {
    const invKey = `${params.shopId}_${v.id}`;
    const expected = store.inventory[invKey]?.quantityOnHand || 0;
    return {
      variantId: v.id,
      expectedQuantity: expected,
      countedQuantity: 0,
      variance: -expected,
    };
  });

  const count: StockCount = {
    id: countId,
    countNumber,
    shopId: params.shopId,
    scope: params.scope,
    scopeFilter: params.scopeFilter,
    status: "COUNTING",
    snapshotAt: Date.now(),
    initiatedBy: params.initiatedBy,
    initiatedByName: params.initiatedByName,
    lines,
    totalVarianceItems: lines.length,
  };

  store.stockCounts.push(count);
  logAuditAction(store, {
    userId: params.initiatedBy,
    userEmailCache: params.initiatedByName,
    action: "STOCK_COUNT_START",
    entityType: "stockCounts",
    entityId: countId,
    shopId: params.shopId,
    after: count,
    reason: `Started stock count ${countNumber} (${params.scope})`,
  });

  saveLocalStore(store);
  return count;
}

export async function submitStockCount(params: {
  countId: string;
  lines: { variantId: string; countedQuantity: number; notes?: string }[];
  submittedBy: string;
}): Promise<StockCount> {
  const store = loadLocalStore();
  const count = store.stockCounts.find((c) => c.id === params.countId);
  if (!count) throw new Error("Stock count record not found");
  if (count.status !== "COUNTING") throw new Error("Stock count is not in COUNTING status");

  let totalVariance = 0;
  count.lines = count.lines.map((l) => {
    const submitted = params.lines.find((sl) => sl.variantId === l.variantId);
    const counted = submitted !== undefined ? submitted.countedQuantity : l.countedQuantity;
    const variance = counted - l.expectedQuantity;
    if (variance !== 0) totalVariance++;
    return {
      ...l,
      countedQuantity: counted,
      variance,
      notes: submitted?.notes || l.notes,
    };
  });

  count.status = "SUBMITTED";
  count.submittedAt = Date.now();
  count.submittedBy = params.submittedBy;
  count.totalVarianceItems = totalVariance;

  logAuditAction(store, {
    userId: params.submittedBy,
    userEmailCache: "Counter",
    action: "STOCK_COUNT_SUBMIT",
    entityType: "stockCounts",
    entityId: count.id,
    shopId: count.shopId,
    after: count,
    reason: `Submitted stock count ${count.countNumber}`,
  });

  saveLocalStore(store);
  return count;
}

export async function approveStockCount(params: {
  countId: string;
  approvedBy: string;
  approvedByName: string;
}): Promise<StockCount> {
  const store = loadLocalStore();
  const count = store.stockCounts.find((c) => c.id === params.countId);
  if (!count) throw new Error("Stock count record not found");
  if (count.status !== "SUBMITTED") throw new Error("Stock count must be SUBMITTED before approval");

  // Post adjustments for variances
  for (const l of count.lines) {
    if (l.variance === 0) continue;

    const invKey = `${count.shopId}_${l.variantId}`;
    if (!store.inventory[invKey]) {
      store.inventory[invKey] = {
        id: invKey,
        shopId: count.shopId,
        variantId: l.variantId,
        productId: "",
        quantityOnHand: 0,
        reorderLevel: 2,
        lastMovementAt: Date.now(),
      };
    }

    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = l.countedQuantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    store.movements.push({
      id: `mvt_${Date.now()}_cnt_${l.variantId}`,
      shopId: count.shopId,
      variantId: l.variantId,
      productId: store.inventory[invKey].productId,
      type: l.variance > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantity: Math.abs(l.variance),
      direction: l.variance > 0 ? "IN" : "OUT",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      reason: `Stock Count ${count.countNumber} reconciliation`,
      referenceType: "STOCK_COUNT",
      referenceId: count.id,
      userId: params.approvedBy,
      createdAt: Date.now(),
    });
  }

  count.status = "APPROVED";
  count.approvedAt = Date.now();
  count.approvedBy = params.approvedBy;
  count.approvedByName = params.approvedByName;

  logAuditAction(store, {
    userId: params.approvedBy,
    userEmailCache: params.approvedByName,
    action: "STOCK_COUNT_APPROVE",
    entityType: "stockCounts",
    entityId: count.id,
    shopId: count.shopId,
    after: count,
    reason: `Super Admin approved count ${count.countNumber} and posted adjustments`,
  });

  saveLocalStore(store);
  return count;
}

// ==========================================
// 10. PURCHASING & SUPPLIER LEDGER
// ==========================================
export function getPurchases(shopId?: string): Purchase[] {
  const store = loadLocalStore();
  if (!shopId) return store.purchases.sort((a, b) => b.receivedAt - a.receivedAt);
  return store.purchases.filter((p) => p.shopId === shopId).sort((a, b) => b.receivedAt - a.receivedAt);
}

export function getSupplierLedger(supplierId: string): {
  transactions: SupplierTransaction[];
  outstandingBalance: number;
} {
  const store = loadLocalStore();
  const txs = store.supplierTransactions
    .filter((t) => t.supplierId === supplierId)
    .sort((a, b) => a.date - b.date);

  let balance = 0;
  const processed = txs.map((t) => {
    balance += t.credit - t.debit;
    return { ...t, balanceAfter: balance };
  });

  return { transactions: processed, outstandingBalance: balance };
}

export async function createPurchaseOrder(params: {
  shopId: string;
  supplierId: string;
  items: { variant: ProductVariant; quantity: number; unitCost: number }[];
  receivedBy: string;
  notes?: string;
}): Promise<Purchase> {
  const store = loadLocalStore();
  const supplier = store.suppliers.find((s) => s.id === params.supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const purchaseNumber = getNextSequentialNumber("PUR", "purchase");
  const purchaseId = `pur_${Date.now()}`;

  const purchaseItems: PurchaseItem[] = [];
  let totalAmount = 0;

  for (const it of params.items) {
    const lineTotal = it.quantity * it.unitCost;
    totalAmount += lineTotal;

    const invKey = `${params.shopId}_${it.variant.id}`;
    if (!store.inventory[invKey]) {
      store.inventory[invKey] = {
        id: invKey,
        shopId: params.shopId,
        variantId: it.variant.id,
        productId: it.variant.productId,
        quantityOnHand: 0,
        reorderLevel: 2,
        lastMovementAt: Date.now(),
      };
    }

    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty + it.quantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    purchaseItems.push({
      variantId: it.variant.id,
      productId: it.variant.productId,
      quantity: it.quantity,
      unitCost: it.unitCost,
      lineTotal,
      variantDescriptionCache: `${it.variant.productNameCache} - ${it.variant.colorNameCache} - ${it.variant.sizeLabelCache}`,
    });

    store.movements.push({
      id: `mvt_${Date.now()}_pur_${it.variant.id}`,
      shopId: params.shopId,
      variantId: it.variant.id,
      productId: it.variant.productId,
      type: "PURCHASE_IN",
      quantity: it.quantity,
      direction: "IN",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      referenceType: "PURCHASE",
      referenceId: purchaseId,
      userId: params.receivedBy,
      createdAt: Date.now(),
    });
  }

  const purchase: Purchase = {
    id: purchaseId,
    purchaseNumber,
    shopId: params.shopId,
    supplierId: params.supplierId,
    supplierNameCache: supplier.name,
    invoiceDate: Date.now(),
    totalAmount,
    status: "RECEIVED",
    items: purchaseItems,
    receivedBy: params.receivedBy,
    receivedAt: Date.now(),
    notes: params.notes,
  };

  const tx: SupplierTransaction = {
    id: `stx_${Date.now()}`,
    supplierId: params.supplierId,
    shopId: params.shopId,
    date: Date.now(),
    type: "PURCHASE",
    referenceId: purchaseId,
    referenceNumber: purchaseNumber,
    debit: 0,
    credit: totalAmount,
    balanceAfter: 0,
    notes: `Purchase Inward Bill #${purchaseNumber}`,
    createdAt: Date.now(),
  };

  store.purchases.push(purchase);
  store.supplierTransactions.push(tx);

  logAuditAction(store, {
    userId: params.receivedBy,
    userEmailCache: "Purchasing Officer",
    action: "PURCHASE_CREATE",
    entityType: "purchases",
    entityId: purchaseId,
    shopId: params.shopId,
    after: purchase,
    reason: `Created purchase ${purchaseNumber} for supplier ${supplier.name}`,
  });

  saveLocalStore(store);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "purchases", purchaseId), purchase);
    batch.set(doc(db, "supplierTransactions", tx.id), tx);
    await batch.commit();
  } catch (e) {
    console.warn("Firestore sync purchase error:", e);
  }

  return purchase;
}

// ==========================================
// 11. CHEQUES & SUPPLIER PAYMENTS (Super Admin Only!)
// ==========================================
export function getCheques(): Cheque[] {
  const store = loadLocalStore();
  return store.cheques.sort((a, b) => b.dueDate - a.dueDate);
}

export async function createChequePayment(params: {
  supplierId: string;
  shopId: string;
  amount: number;
  chequeNumber: string;
  bankName: string;
  dueDate: number;
  notes?: string;
  performedByRole: string;
}): Promise<Cheque> {
  if (params.performedByRole !== "SUPER_ADMIN") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

  const store = loadLocalStore();
  const supplier = store.suppliers.find((s) => s.id === params.supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const chequeId = `chq_${Date.now()}`;
  const cheque: Cheque = {
    id: chequeId,
    chequeNumber: params.chequeNumber,
    supplierId: params.supplierId,
    supplierNameCache: supplier.name,
    shopId: params.shopId,
    bankName: params.bankName,
    amount: params.amount,
    issueDate: Date.now(),
    dueDate: params.dueDate,
    clearedDate: null,
    status: "PENDING",
    notes: params.notes,
    history: [
      {
        from: "NEW",
        to: "PENDING",
        at: Date.now(),
        by: "admin",
        reason: "Cheque issued",
      },
    ],
    createdAt: Date.now(),
  };

  store.cheques.push(cheque);
  logAuditAction(store, {
    userId: "admin",
    userEmailCache: "Super Admin",
    action: "CHEQUE_CREATE",
    entityType: "cheques",
    entityId: chequeId,
    shopId: params.shopId,
    after: cheque,
    reason: `Issued post-dated cheque ${params.chequeNumber} for Rs. ${params.amount}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "cheques", chequeId), cheque);
  } catch (e) {
    console.warn("Firestore sync cheque error:", e);
  }

  return cheque;
}

export async function updateChequeStatus(params: {
  chequeId: string;
  newStatus: ChequeStatus;
  notes?: string;
  performedByRole: string;
}): Promise<Cheque> {
  if (params.performedByRole !== "SUPER_ADMIN") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

  const store = loadLocalStore();
  const cheque = store.cheques.find((c) => c.id === params.chequeId);
  if (!cheque) throw new Error("Cheque not found");

  const prev = cheque.status;

  // Strict Transition Rules (Section 5.3)
  if (prev === "CLEARED" && params.newStatus === "PENDING") {
    throw new Error(ERROR_MESSAGES.CHEQUE_INVALID_TRANSITION);
  }
  if ((prev === "BOUNCED" || prev === "CANCELLED") && params.newStatus !== prev) {
    throw new Error(ERROR_MESSAGES.CHEQUE_INVALID_TRANSITION);
  }

  cheque.status = params.newStatus;
  if (!cheque.history) cheque.history = [];

  cheque.history.push({
    from: prev,
    to: params.newStatus,
    at: Date.now(),
    by: "admin",
    reason: params.notes,
  });

  if (params.newStatus === "CLEARED") {
    cheque.clearedDate = Date.now();
    // Post Debit payment to supplier ledger when cheque CLEARS
    const tx: SupplierTransaction = {
      id: `stx_chq_${Date.now()}`,
      supplierId: cheque.supplierId,
      shopId: cheque.shopId,
      date: Date.now(),
      type: "PAYMENT",
      referenceId: cheque.id,
      referenceNumber: cheque.chequeNumber,
      debit: cheque.amount,
      credit: 0,
      balanceAfter: 0,
      notes: `Cheque #${cheque.chequeNumber} CLEARED (${cheque.bankName})`,
      createdAt: Date.now(),
    };
    store.supplierTransactions.push(tx);
  } else if (params.newStatus === "BOUNCED" && prev === "CLEARED") {
    // Reverse the debit
    const revTx: SupplierTransaction = {
      id: `stx_rev_${Date.now()}`,
      supplierId: cheque.supplierId,
      shopId: cheque.shopId,
      date: Date.now(),
      type: "ADJUSTMENT",
      referenceId: cheque.id,
      referenceNumber: cheque.chequeNumber,
      debit: 0,
      credit: cheque.amount,
      balanceAfter: 0,
      notes: `Reversal for BOUNCED cheque #${cheque.chequeNumber}`,
      createdAt: Date.now(),
    };
    store.supplierTransactions.push(revTx);
  }

  logAuditAction(store, {
    userId: "admin",
    userEmailCache: "Super Admin",
    action: "CHEQUE_STATUS_CHANGE",
    entityType: "cheques",
    entityId: cheque.id,
    shopId: cheque.shopId,
    before: { status: prev },
    after: { status: params.newStatus },
    reason: params.notes || `Cheque status moved to ${params.newStatus}`,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "cheques", cheque.id), {
      status: params.newStatus,
      clearedDate: cheque.clearedDate,
    });
  } catch (e) {
    console.warn("Firestore sync cheque status error:", e);
  }

  return cheque;
}

// ==========================================
// 12. INVENTORY ADJUSTMENTS
// ==========================================
export async function adjustStock(params: {
  shopId: string;
  variantId: string;
  type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE";
  quantity: number;
  reason: string;
  userId: string;
}): Promise<void> {
  const store = loadLocalStore();
  const invKey = `${params.shopId}_${params.variantId}`;
  if (!store.inventory[invKey]) {
    throw new Error("Inventory record not found for variant.");
  }

  const beforeQty = store.inventory[invKey].quantityOnHand;
  let afterQty = beforeQty;

  if (params.type === "ADJUSTMENT_IN") {
    afterQty = beforeQty + params.quantity;
  } else {
    if (beforeQty < params.quantity) {
      throw new Error(`Cannot adjust out ${params.quantity}. Only ${beforeQty} on hand.`);
    }
    afterQty = beforeQty - params.quantity;
  }

  store.inventory[invKey].quantityOnHand = afterQty;
  store.inventory[invKey].lastMovementAt = Date.now();

  store.movements.push({
    id: `mvt_adj_${Date.now()}`,
    shopId: params.shopId,
    variantId: params.variantId,
    productId: store.inventory[invKey].productId,
    type: params.type,
    quantity: params.quantity,
    direction: params.type === "ADJUSTMENT_IN" ? "IN" : "OUT",
    quantityBefore: beforeQty,
    quantityAfter: afterQty,
    reason: params.reason,
    referenceType: "ADJUSTMENT",
    referenceId: `adj_${Date.now()}`,
    userId: params.userId,
    createdAt: Date.now(),
  });

  logAuditAction(store, {
    userId: params.userId,
    userEmailCache: "Stock Manager",
    action: "STOCK_ADJUSTMENT",
    entityType: "inventory",
    entityId: invKey,
    shopId: params.shopId,
    before: { quantityOnHand: beforeQty },
    after: { quantityOnHand: afterQty },
    reason: params.reason,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "inventory", invKey), {
      quantityOnHand: afterQty,
      lastMovementAt: Date.now(),
    });
  } catch (e) {
    console.warn("Firestore sync adjust stock error:", e);
  }
}

export function getStockMovements(shopId: string): StockMovement[] {
  const store = loadLocalStore();
  return store.movements.filter((m) => m.shopId === shopId).sort((a, b) => b.createdAt - a.createdAt);
}

// ==========================================
// 13. USER MANAGEMENT (Section 5.9)
// ==========================================
export async function createUserProfile(params: {
  email: string;
  displayName: string;
  role: "SUPER_ADMIN" | "SHOP_MANAGER" | "CASHIER";
  allowedShopIds: string[];
  discountCap?: number;
  cashRefundCap?: number;
  createdBy: string;
}): Promise<UserProfile> {
  const store = loadLocalStore();
  const existing = store.users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    throw new Error("A user with this email address already exists.");
  }

  const newUser: UserProfile = {
    uid: `user_${Date.now()}`,
    email: params.email,
    displayName: params.displayName,
    role: params.role,
    allowedShopIds: params.allowedShopIds,
    active: true,
    mustChangePassword: true,
    discountCap: params.discountCap || (params.role === "CASHIER" ? 0 : 15),
    cashRefundCap: params.cashRefundCap || (params.role === "CASHIER" ? 3000 : 10000),
    canCreatePurchase: params.role === "SUPER_ADMIN",
  };

  store.users.push(newUser);
  logAuditAction(store, {
    userId: params.createdBy,
    userEmailCache: "Admin",
    action: "USER_CREATE",
    entityType: "users",
    entityId: newUser.uid,
    after: newUser,
    reason: `Created user ${newUser.displayName} (${newUser.role})`,
  });

  saveLocalStore(store);
  return newUser;
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>,
  updatedBy: string
): Promise<UserProfile> {
  const store = loadLocalStore();
  const user = store.users.find((u) => u.uid === uid);
  if (!user) throw new Error("User not found");

  const prev = { ...user };
  Object.assign(user, updates);

  logAuditAction(store, {
    userId: updatedBy,
    userEmailCache: "Admin",
    action: "USER_UPDATE",
    entityType: "users",
    entityId: uid,
    before: prev,
    after: user,
    reason: `Updated user profile for ${user.displayName}`,
  });

  saveLocalStore(store);
  return user;
}

export async function toggleUserActive(
  uid: string,
  active: boolean,
  updatedBy: string
): Promise<UserProfile> {
  const store = loadLocalStore();
  const user = store.users.find((u) => u.uid === uid);
  if (!user) throw new Error("User not found");

  // Guard: Cannot disable last Super Admin (Rule T-14)
  if (!active && user.role === "SUPER_ADMIN") {
    const activeAdmins = store.users.filter((u) => u.role === "SUPER_ADMIN" && u.active);
    if (activeAdmins.length <= 1) {
      throw new Error(ERROR_MESSAGES.LAST_ADMIN);
    }
  }

  user.active = active;
  logAuditAction(store, {
    userId: updatedBy,
    userEmailCache: "Admin",
    action: active ? "USER_ENABLE" : "USER_DISABLE",
    entityType: "users",
    entityId: uid,
    reason: `Set user active to ${active}`,
  });

  saveLocalStore(store);
  return user;
}

// ==========================================
// 14. AUDIT LOGGING HELPER
// ==========================================
function logAuditAction(
  store: LocalStoreState,
  entry: Omit<AuditLog, "id" | "createdAt">
) {
  const log: AuditLog = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    ...entry,
  };
  store.auditLogs.unshift(log);
}

export function getAuditLogs(shopId?: string): AuditLog[] {
  const store = loadLocalStore();
  if (!shopId) return store.auditLogs;
  return store.auditLogs.filter((a) => !a.shopId || a.shopId === shopId);
}
