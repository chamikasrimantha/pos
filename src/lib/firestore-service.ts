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
  UserRole,
  Category,
  Brand,
  Color,
  ShoeSize,
  Product,
  ProductVariant,
  ProductType,
  ReviewStatus,
  Inventory,
  StockMovement,
  CashierShift,
  DailyCashSummary,
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
  Customer,
  CustomerType,
  CustomerLedgerEntry,
  CustomerLedgerEntryType,
  CustomerPaymentReceipt,
  CashAdvanceReceipt,
  SettledInvoiceRecord,
  PaymentStatus,
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
  SEED_SALES,
  SEED_SALE_ITEMS,
  SEED_CUSTOMERS,
  SEED_CUSTOMER_LEDGER,
  SEED_CUSTOMER_PAYMENTS,
  SEED_CASH_ADVANCES,
} from "./seed-data";
import { computeDailyCashSummary } from "./daily-cash-math";
import { can } from "./permissions";
import {
  getColomboDayRange,
  getColomboMonthRange,
  formatColomboDateKey,
  getColomboDateParts,
} from "./date-utils";

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
  customers: Customer[];
  customerLedger: CustomerLedgerEntry[];
  customerPayments: CustomerPaymentReceipt[];
  cashAdvances: CashAdvanceReceipt[];
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
    sales: [...SEED_SALES],
    saleItems: [...SEED_SALE_ITEMS],
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
    customers: [...SEED_CUSTOMERS],
    customerLedger: [...SEED_CUSTOMER_LEDGER],
    customerPayments: [...SEED_CUSTOMER_PAYMENTS],
    cashAdvances: [...SEED_CASH_ADVANCES],
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
      "rightway_pay": 1,
      "mega_pay": 1,
      "rightway_adv": 1,
      "mega_adv": 1,
      "transfer": 15,
      "purchase": 10,
    },
  };
}

function cleanManagerUsers(store: LocalStoreState): boolean {
  let changed = false;
  const isReferenced = (uid: string) => {
    return (
      store.sales.some((s) => s.cashierId === uid || s.cancelledBy === uid) ||
      store.saleItems.some((si) => si.cashierId === uid) ||
      store.returns.some((r) => r.cashierId === uid || r.approvedBy === uid) ||
      store.repairs.some((rp) => rp.intakeCashierId === uid || rp.deliveryCashierId === uid) ||
      store.transfers.some((t) => t.dispatchedBy === uid || t.receivedBy === uid) ||
      store.purchases.some((p) => p.receivedBy === uid) ||
      store.auditLogs.some((a) => a.userId === uid)
    );
  };

  const newUsers: UserProfile[] = [];
  for (const u of store.users) {
    if (u.role === "SHOP_MANAGER") {
      if (isReferenced(u.uid)) {
        if (u.active !== false || u.hidden !== true) {
          u.active = false;
          u.hidden = true;
          changed = true;
        }
        newUsers.push(u);
      } else {
        // Delete unreferenced manager user
        changed = true;
      }
    } else {
      newUsers.push(u);
    }
  }
  if (changed) {
    store.users = newUsers;
  }
  return changed;
}

let nodeStore: LocalStoreState | null = null;

export function resetLocalStoreForTesting() {
  nodeStore = null;
}

export function loadLocalStore(): LocalStoreState {
  if (typeof window === "undefined") {
    if (!nodeStore) {
      nodeStore = getInitialStore();
      cleanManagerUsers(nodeStore);
    }
    return nodeStore;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = getInitialStore();
      cleanManagerUsers(initial);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Ensure all arrays & settings exist
    if (!parsed.stockCounts) parsed.stockCounts = [];
    if (!parsed.cashMovements) parsed.cashMovements = [];
    if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    if (!parsed.customers || parsed.customers.length === 0) {
      parsed.customers = [...SEED_CUSTOMERS];
    }
    if (!parsed.customerLedger) parsed.customerLedger = [...SEED_CUSTOMER_LEDGER];
    if (!parsed.customerPayments) parsed.customerPayments = [...SEED_CUSTOMER_PAYMENTS];
    if (!parsed.cashAdvances) parsed.cashAdvances = [...SEED_CASH_ADVANCES];
    if (!parsed.counters) parsed.counters = {};
    if (parsed.counters["rightway_pay"] === undefined) parsed.counters["rightway_pay"] = 1;
    if (parsed.counters["mega_pay"] === undefined) parsed.counters["mega_pay"] = 1;
    if (parsed.counters["rightway_adv"] === undefined) parsed.counters["rightway_adv"] = 1;
    if (parsed.counters["mega_adv"] === undefined) parsed.counters["mega_adv"] = 1;
    if (!parsed.sales || parsed.sales.length === 0) {
      parsed.sales = [...SEED_SALES];
      parsed.saleItems = [...SEED_SALE_ITEMS];
    }
    if (!parsed.inventory) parsed.inventory = {};

    let dataSynced = false;
    // Auto-merge new categories, brands, sizes, products, variants & inventory
    SEED_CATEGORIES.forEach((c) => {
      if (!parsed.categories?.some((pc: Category) => pc.id === c.id)) {
        if (!parsed.categories) parsed.categories = [];
        parsed.categories.push({ ...c });
        dataSynced = true;
      }
    });
    SEED_BRANDS.forEach((b) => {
      if (!parsed.brands?.some((pb: Brand) => pb.id === b.id)) {
        if (!parsed.brands) parsed.brands = [];
        parsed.brands.push({ ...b });
        dataSynced = true;
      }
    });
    SEED_SIZES.forEach((s) => {
      if (!parsed.sizes?.some((ps: ShoeSize) => ps.id === s.id)) {
        if (!parsed.sizes) parsed.sizes = [];
        parsed.sizes.push({ ...s });
        dataSynced = true;
      }
    });
    SEED_PRODUCTS.forEach((p) => {
      if (!parsed.products?.some((pp: Product) => pp.id === p.id)) {
        if (!parsed.products) parsed.products = [];
        parsed.products.push({ ...p });
        dataSynced = true;
      }
    });
    SEED_VARIANTS.forEach((v) => {
      if (!parsed.variants?.some((pv: ProductVariant) => pv.id === v.id)) {
        if (!parsed.variants) parsed.variants = [];
        parsed.variants.push({ ...v });
        dataSynced = true;
      }
    });
    SEED_INVENTORIES.forEach((inv) => {
      if (!parsed.inventory[inv.id]) {
        parsed.inventory[inv.id] = { ...inv };
        dataSynced = true;
      }
    });

    if (cleanManagerUsers(parsed) || dataSynced) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (err) {
    console.warn("Failed to parse local POS store:", err);
    return getInitialStore();
  }
}

export function saveLocalStore(state: LocalStoreState) {
  if (typeof window === "undefined") {
    nodeStore = state;
    return;
  }
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

export function getUsers(includeHidden = false): UserProfile[] {
  return loadLocalStore().users.filter((u) => includeHidden || !u.hidden);
}

export function getCategories(productType?: ProductType): Category[] {
  const cats = loadLocalStore().categories;
  if (!productType) return cats;
  return cats.filter((c) => !c.productType || c.productType === productType);
}

export function getBrands(productType?: ProductType): Brand[] {
  const brands = loadLocalStore().brands;
  if (!productType) return brands;
  return brands.filter(
    (b) => !b.productType || b.productType === "BOTH" || b.productType === productType
  );
}

export function getColors(): Color[] {
  return loadLocalStore().colors;
}

export function getSizes(productType?: ProductType): ShoeSize[] {
  const sizes = loadLocalStore().sizes;
  if (!productType) return sizes;
  return sizes.filter((s) => !s.productType || s.productType === productType);
}

export function getProducts(productType?: ProductType): Product[] {
  const products = loadLocalStore().products;
  if (!productType) return products;
  return products.filter((p) => (p.productType || "FOOTWEAR") === productType);
}

export function getVariants(productType?: ProductType): ProductVariant[] {
  const variants = loadLocalStore().variants;
  if (!productType) return variants;
  return variants.filter((v) => (v.productType || "FOOTWEAR") === productType);
}

/**
 * Mathematically generates a valid, unique 13-digit EAN barcode with correct Modulo-10 checksum
 */
export function generateEan13Barcode(existingBarcodes?: string[]): string {
  const store = loadLocalStore();
  const knownBarcodes = new Set(existingBarcodes || store.variants.map((v) => v.barcode));

  for (let attempt = 0; attempt < 200; attempt++) {
    // Generate 12 digits: Sri Lanka country/in-store prefix "20" + 10 random digits
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const base12 = "20" + random10;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base12[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    const candidate = base12 + checksum.toString();
    if (!knownBarcodes.has(candidate)) {
      return candidate;
    }
  }

  // Fallback timestamp-based
  const ts = Date.now().toString().slice(-10);
  const base12 = "20" + ts;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return base12 + checksum.toString();
}

export interface QuickProductInput {
  productType: ProductType;
  name: string;
  categoryId: string;
  brandId: string;
  colorId: string;
  sizeId: string;
  sellingPrice: number;
  referenceCostPrice?: number;
  startingQuantity?: number;
  shopId: string;
  createdBy: string;
  barcode?: string;
  sku?: string;
}

export async function createQuickProduct(
  input: QuickProductInput
): Promise<{ product: Product; variant: ProductVariant }> {
  const store = loadLocalStore();
  const now = Date.now();

  const category = store.categories.find((c) => c.id === input.categoryId);
  const brand = store.brands.find((b) => b.id === input.brandId);
  const color = store.colors.find((c) => c.id === input.colorId);
  const size = store.sizes.find((s) => s.id === input.sizeId);

  // Barcode generation or uniqueness check
  let barcode = (input.barcode || "").trim();
  if (!barcode) {
    barcode = generateEan13Barcode(store.variants.map((v) => v.barcode));
  } else {
    const exists = store.variants.some((v) => v.barcode === barcode);
    if (exists) {
      throw new Error(`Barcode "${barcode}" is already registered to an existing product variant.`);
    }
  }

  // SKU generation or uniqueness check
  let sku = (input.sku || "").trim().toUpperCase();
  if (!sku) {
    const brandPrefix = (brand?.name || "GEN").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
    const namePrefix = input.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "ITM";
    const colPrefix = (color?.name || "CLR").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
    const szClean = (size?.label || "STD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
    const typePrefix = input.productType === "BAG" ? "BAG" : "FTW";
    sku = `${typePrefix}-${brandPrefix}-${namePrefix}-${colPrefix}-${szClean}`;
    if (store.variants.some((v) => v.sku === sku)) {
      sku = `${sku}-${Math.floor(10 + Math.random() * 90)}`;
    }
  }

  const productId = `prod_quick_${now}_${Math.floor(100 + Math.random() * 900)}`;
  const variantId = `var_quick_${now}_${Math.floor(100 + Math.random() * 900)}`;

  const newProduct: Product = {
    id: productId,
    name: input.name.trim(),
    productType: input.productType,
    brandId: input.brandId,
    categoryId: input.categoryId,
    gender: input.productType === "BAG" ? "UNISEX" : (size?.gender || "UNISEX"),
    active: true,
    reviewStatus: "NEEDS_REVIEW",
    reviewReason: "Quick added at counter",
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  const newVariant: ProductVariant = {
    id: variantId,
    productId: productId,
    productType: input.productType,
    colorId: input.colorId,
    sizeId: input.sizeId,
    sku: sku,
    barcode: barcode,
    barcodeSource: "INTERNAL",
    referenceCostPrice: input.referenceCostPrice || 0,
    sellingPrice: input.sellingPrice,
    productNameCache: input.name.trim(),
    brandNameCache: brand?.name || "Generic",
    colorNameCache: color?.name || "Standard",
    sizeLabelCache: size?.label || "Standard",
    reviewStatus: "NEEDS_REVIEW",
    active: true,
  };

  store.products.push(newProduct);
  store.variants.push(newVariant);

  const qty = Number(input.startingQuantity) || 0;
  if (qty > 0) {
    const invKey = `${input.shopId}_${variantId}`;
    store.inventory[invKey] = {
      id: invKey,
      shopId: input.shopId,
      variantId: variantId,
      productId: productId,
      quantityOnHand: qty,
      reorderLevel: 2,
      lastMovementAt: now,
    };

    const movId = `mov_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const movement: StockMovement = {
      id: movId,
      shopId: input.shopId,
      variantId: variantId,
      productId: productId,
      type: "ADJUSTMENT_IN",
      quantity: qty,
      direction: "IN",
      quantityBefore: 0,
      quantityAfter: qty,
      referenceType: "ADJUSTMENT",
      referenceId: "QUICK_ADD",
      userId: input.createdBy,
      createdAt: now,
      reason: "Quick add starting stock at counter",
    };
    store.movements.push(movement);
  }

  logAuditAction(store, {
    userId: input.createdBy,
    userEmailCache: input.createdBy,
    action: "QUICK_ADD_PRODUCT",
    entityType: "product",
    entityId: newProduct.id,
    before: null,
    after: { product: newProduct, variant: newVariant, startingQuantity: qty },
    reason: `Quick-added product "${newProduct.name}" (${newVariant.sku})`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "products", newProduct.id), newProduct);
    await setDoc(doc(db, "productVariants", newVariant.id), newVariant);
    if (qty > 0) {
      const invKey = `${input.shopId}_${variantId}`;
      await setDoc(doc(db, "inventory", invKey), store.inventory[invKey]);
    }
  } catch (err) {
    console.warn("Firestore sync quick add error:", err);
  }

  return { product: newProduct, variant: newVariant };
}

export interface UpdateProductMasterInput {
  productId: string;
  variantId: string;
  name?: string;
  brandId?: string;
  categoryId?: string;
  productType?: ProductType;
  colorId?: string;
  sizeId?: string;
  sku?: string;
  barcode?: string;
  sellingPrice?: number;
  referenceCostPrice?: number;
  active?: boolean;
  user: UserProfile;
}

export async function updateProductMaster(
  input: UpdateProductMasterInput
): Promise<{ product: Product; variant: ProductVariant }> {
  const store = loadLocalStore();
  const { user } = input;
  const now = Date.now();

  // Section 2.3 Role Enforcement: Cashiers cannot edit existing catalog products
  if (user.role === "CASHIER") {
    throw new Error("Cashiers are not permitted to edit existing catalogue products.");
  }

  const product = store.products.find((p) => p.id === input.productId);
  if (!product) throw new Error("Product not found");

  const variant = store.variants.find((v) => v.id === input.variantId);
  if (!variant) throw new Error("Product variant not found");

  const beforeProduct = { ...product };
  const beforeVariant = { ...variant };

  // Shop Manager CANNOT edit cost price
  if (user.role === "SHOP_MANAGER") {
    if (
      input.referenceCostPrice !== undefined &&
      input.referenceCostPrice !== variant.referenceCostPrice
    ) {
      throw new Error("Shop Managers are not permitted to edit cost prices.");
    }
  }

  // Barcode uniqueness check
  if (input.barcode && input.barcode !== variant.barcode) {
    const exists = store.variants.some((v) => v.id !== variant.id && v.barcode === input.barcode);
    if (exists) {
      throw new Error(`Barcode "${input.barcode}" is already registered to another variant.`);
    }
    variant.barcode = input.barcode;
  }

  if (input.name !== undefined) {
    product.name = input.name.trim();
    variant.productNameCache = input.name.trim();
  }
  if (input.productType !== undefined) {
    product.productType = input.productType;
    variant.productType = input.productType;
  }
  if (input.brandId !== undefined) {
    product.brandId = input.brandId;
    const b = store.brands.find((br) => br.id === input.brandId);
    if (b) variant.brandNameCache = b.name;
  }
  if (input.categoryId !== undefined) {
    product.categoryId = input.categoryId;
  }
  if (input.colorId !== undefined) {
    variant.colorId = input.colorId;
    const c = store.colors.find((col) => col.id === input.colorId);
    if (c) variant.colorNameCache = c.name;
  }
  if (input.sizeId !== undefined) {
    variant.sizeId = input.sizeId;
    const s = store.sizes.find((sz) => sz.id === input.sizeId);
    if (s) variant.sizeLabelCache = s.label;
  }
  if (input.sku !== undefined) {
    variant.sku = input.sku.trim();
  }
  if (input.sellingPrice !== undefined) {
    variant.sellingPrice = input.sellingPrice;
  }
  // Cost price: only SUPER_ADMIN
  if (user.role === "SUPER_ADMIN" && input.referenceCostPrice !== undefined) {
    variant.referenceCostPrice = input.referenceCostPrice;
  }
  if (input.active !== undefined) {
    product.active = input.active;
    variant.active = input.active;
  }

  product.updatedAt = now;

  logAuditAction(store, {
    userId: user.uid,
    userEmailCache: user.email || user.displayName,
    action: "UPDATE_PRODUCT",
    entityType: "product",
    entityId: product.id,
    before: { product: beforeProduct, variant: beforeVariant },
    after: { product, variant },
    reason: `Updated product "${product.name}" (${variant.sku})`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "products", product.id), product);
    await setDoc(doc(db, "productVariants", variant.id), variant);
  } catch (err) {
    console.warn("Firestore sync product update error:", err);
  }

  return { product, variant };
}

export async function updateProductReviewStatus(
  productId: string,
  variantId: string,
  status: ReviewStatus,
  reviewerId: string,
  reason?: string
): Promise<void> {
  const store = loadLocalStore();
  const product = store.products.find((p) => p.id === productId);
  const variant = store.variants.find((v) => v.id === variantId);
  if (product) {
    product.reviewStatus = status;
    if (reason) product.reviewReason = reason;
    product.updatedAt = Date.now();
  }
  if (variant) {
    variant.reviewStatus = status;
  }
  saveLocalStore(store);
  try {
    if (product) await setDoc(doc(db, "products", product.id), product);
    if (variant) await setDoc(doc(db, "productVariants", variant.id), variant);
  } catch (e) {
    console.warn("Firestore sync review status error:", e);
  }
}

export function getSuppliers(): Supplier[] {
  return loadLocalStore().suppliers;
}

export function getSuppliersForUser(
  callingUser?: UserProfile | { role: UserRole } | null
): Partial<Supplier>[] {
  const store = loadLocalStore();
  const allSuppliers = store.suppliers.filter((s) => s.active !== false);
  if (!callingUser || callingUser.role === "CASHIER") {
    // Section 7.2: Cashiers see supplier name and phone only
    return allSuppliers.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      active: s.active,
      needsReview: s.needsReview,
    }));
  }
  return allSuppliers;
}

export async function addSupplier(params: {
  name: string;
  phone: string;
  contactPerson?: string;
  address?: string;
  callingUser: UserProfile | { id?: string; role: UserRole; displayName?: string };
}): Promise<Supplier> {
  const store = loadLocalStore();
  const nameNorm = params.name.trim().replace(/\s+/g, "").toLowerCase();
  const phoneNorm = params.phone.trim().replace(/[\s\-\+]/g, "");

  if (!nameNorm) throw new Error("Supplier name is required.");
  if (!phoneNorm) throw new Error("Supplier phone number is required.");

  const duplicate = store.suppliers.find((s) => {
    const sName = s.name.trim().replace(/\s+/g, "").toLowerCase();
    const sPhone = (s.phone || "").trim().replace(/[\s\-\+]/g, "");
    return sName === nameNorm || (phoneNorm && sPhone === phoneNorm);
  });

  if (duplicate) {
    throw new Error("A supplier with this name or phone number already exists.");
  }

  const supplierId = `sup_${Date.now()}`;
  const supplier: Supplier = {
    id: supplierId,
    name: params.name.trim(),
    phone: params.phone.trim(),
    contactPerson: params.contactPerson?.trim() || undefined,
    address: params.address?.trim() || undefined,
    active: true,
    createdAt: Date.now(),
    needsReview: params.callingUser.role !== "SUPER_ADMIN",
  };

  store.suppliers.push(supplier);

  logAuditAction(store, {
    userId: (params.callingUser as any).id || (params.callingUser as any).uid || "system",
    userEmailCache: params.callingUser.displayName || params.callingUser.role,
    action: "SUPPLIER_CREATE",
    entityType: "suppliers",
    entityId: supplierId,
    after: supplier,
    reason: `Created new supplier ${supplier.name}${supplier.needsReview ? " (Needs review)" : ""}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "suppliers", supplierId), supplier);
  } catch (e) {
    console.warn("Firestore sync supplier error:", e);
  }

  return supplier;
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
// 4. DAILY CASH SUMMARY & CASH MANAGEMENT
// ==========================================
export function getDailyCashSummary(params?: {
  shopId?: string;
  cashierId?: string;
  cashierName?: string;
  timestamp?: number;
}): DailyCashSummary {
  const store = loadLocalStore();
  const customerPayments = (store.customerPayments || []).map((cp) => ({
    amount: cp.amount,
    paymentMethod: cp.method,
    cashierId: cp.receivedBy,
    shopId: cp.shopId,
    createdAt: cp.createdAt,
  }));
  const cashAdvances = (store.cashAdvances || []).map((ca) => ({
    amount: ca.amount,
    cashierId: ca.issuedBy,
    shopId: ca.shopId,
    createdAt: ca.createdAt,
  }));

  const summary = computeDailyCashSummary({
    shopId: params?.shopId,
    cashierId: params?.cashierId,
    cashierName: params?.cashierName,
    timestamp: params?.timestamp,
    sales: store.sales,
    returns: store.returns,
    repairs: store.repairs,
    customerPayments,
    cashAdvances,
  });

  // If viewing across a branch or central (all branches) without cashier filter, compute per-cashier breakdowns
  if (!params?.cashierId) {
    const cashiers = store.users.filter((u) => u.role === "CASHIER");
    const breakdowns: DailyCashSummary[] = [];
    for (const c of cashiers) {
      if (params?.shopId && params.shopId !== "ALL" && !c.allowedShopIds?.includes(params.shopId)) {
        continue;
      }
      const cSummary = computeDailyCashSummary({
        shopId: params?.shopId,
        cashierId: c.uid,
        cashierName: c.displayName,
        timestamp: params?.timestamp,
        sales: store.sales,
        returns: store.returns,
        repairs: store.repairs,
        customerPayments,
        cashAdvances,
      });
      breakdowns.push(cSummary);
    }
    summary.cashierBreakdowns = breakdowns;
  }

  return summary;
}

// ==========================================
// 5. ATOMIC POS SALE COMPLETION
// ==========================================
export async function completeSale(params: {
  shopId: string;
  cashierId: string;
  cashierName: string;
  shiftId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: {
    variant: ProductVariant;
    quantity: number;
    unitPrice: number;
    listPrice?: number;
    priceOverridden?: boolean;
    priceOverrideReason?: string;
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

  // 0. Data-layer guard: Super Admin cannot make sales
  const cashier = store.users.find((u) => u.uid === params.cashierId);
  if (cashier?.role === "SUPER_ADMIN") {
    throw new Error("The administrator account cannot make sales");
  }

  // 1. Idempotency Check
  if (params.idempotencyKey) {
    const existingSale = store.sales.find((s) => s.idempotencyKey === params.idempotencyKey);
    if (existingSale) {
      const items = store.saleItems.filter((i) => i.saleId === existingSale.id);
      return { sale: existingSale, items };
    }
  }

  // 2. Validate price floors (Section 4.5 / Acceptance X7)
  const settings = store.settings || DEFAULT_SETTINGS;
  const floorMode = settings.priceFloorMode || "NONE";
  const floorValue = settings.priceFloorValue || 0;

  for (const item of params.items) {
    const listPrice = item.listPrice !== undefined ? item.listPrice : item.variant.sellingPrice;
    const isOverridden = item.priceOverridden || item.unitPrice !== listPrice;

    if (isOverridden) {
      if (floorMode === "PERCENT_OF_LIST" && floorValue > 0) {
        const minPrice = (listPrice * floorValue) / 100;
        if (item.unitPrice < minPrice - 0.01) {
          throw new Error("This price is too low.");
        }
      } else if (floorMode === "COST") {
        const costPrice = item.variant.referenceCostPrice || 0;
        if (item.unitPrice < costPrice) {
          throw new Error("This price is too low.");
        }
      }
    }
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

  // 4. Validate Credit Sales & Customer Limit (Section 5.2 / Acceptance C1, C2, C4)
  const creditPaymentEntry = params.payments.find((p) => p.method === "CREDIT");
  const isCreditSale = !!creditPaymentEntry && creditPaymentEntry.amount > 0;

  let customerId = params.customerId;
  let customerName = params.customerName;
  let customerPhone = params.customerPhone;
  let amountPaid = params.total;
  let balanceDue = 0;
  let paymentStatus: PaymentStatus = "PAID";

  if (isCreditSale) {
    if (!customerId) {
      throw new Error("A customer is required for credit sales.");
    }
    const customer = store.customers.find((c) => c.id === customerId);
    if (!customer) {
      throw new Error("Customer not found.");
    }
    if (!customer.active) {
      throw new Error("Selected customer account is inactive.");
    }

    customerId = customer.id;
    customerName = customer.name;
    customerPhone = customer.phone;

    // Derived current balance from customer ledger (sum of debits minus credits)
    const customerEntries = (store.customerLedger || []).filter((e) => e.customerId === customer.id);
    const currentBalance = customerEntries.reduce((bal, e) => {
      if (e.direction === "DEBIT") return bal + e.amount;
      if (e.direction === "CREDIT") return bal - e.amount;
      return bal;
    }, 0);

    const creditAmount = creditPaymentEntry.amount;

    if (customer.creditLimit && customer.creditLimit > 0) {
      if (currentBalance + creditAmount > customer.creditLimit) {
        throw new Error("Credit limit reached");
      }
    }

    amountPaid = Math.max(0, params.total - creditAmount);
    balanceDue = creditAmount;
    paymentStatus = amountPaid === 0 ? "CREDIT" : balanceDue > 0 ? "PARTIALLY_PAID" : "PAID";
  } else if (customerId) {
    const customer = store.customers.find((c) => c.id === customerId);
    if (customer) {
      customerName = customer.name;
      customerPhone = customer.phone;
    }
  }

  // 5. Generate sequential invoice number
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
    customerId,
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    subtotal: params.subtotal,
    discount: params.discount,
    taxAmount: params.taxAmount,
    total: params.total,
    amountPaid,
    balanceDue,
    paymentStatus,
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

  // 6. Atomic inventory decrement & movement logging
  for (const item of params.items) {
    const invKey = `${params.shopId}_${item.variant.id}`;
    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty - item.quantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    const listPrice = item.listPrice !== undefined ? item.listPrice : item.variant.sellingPrice;
    const isOverridden = item.priceOverridden !== undefined ? item.priceOverridden : (item.unitPrice !== listPrice);

    const saleItemId = `si_${Date.now()}_${item.variant.id}_${Math.floor(Math.random() * 1000)}`;
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
      listPrice,
      priceOverridden: isOverridden,
      priceOverrideReason: item.priceOverrideReason,
      discount: item.discount,
      lineTotal: item.lineTotal,
      variantDescriptionCache: `${item.variant.productNameCache} - ${item.variant.colorNameCache} - ${item.variant.sizeLabelCache}`,
    };
    createdItems.push(sItem);

    if (isOverridden) {
      logAuditAction(store, {
        userId: params.cashierId,
        userEmailCache: params.cashierName,
        action: "PRICE_OVERRIDE",
        entityType: "sale",
        entityId: saleId,
        before: { listPrice },
        after: {
          unitSellingPrice: item.unitPrice,
          quantity: item.quantity,
          reason: item.priceOverrideReason || "Price overridden at POS counter",
        },
        reason: `Price override on ${item.variant.productNameCache}: catalogue Rs. ${listPrice}, charged Rs. ${item.unitPrice}`,
      });
    }

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

  // 7. Write Customer Ledger Entry for Credit Sale (Section 5.3 / Acceptance C1)
  if (isCreditSale && balanceDue > 0 && customerId) {
    const ledgerEntry: CustomerLedgerEntry = {
      id: `cled_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId,
      shopId: params.shopId,
      type: "CREDIT_SALE",
      amount: balanceDue,
      direction: "DEBIT",
      saleId,
      referenceNumber: invoiceNumber,
      method: "CREDIT",
      note: `Credit sale invoice #${invoiceNumber}`,
      createdBy: params.cashierId,
      createdAt: Date.now(),
    };
    store.customerLedger.push(ledgerEntry);
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
// 6. INVOICES & USER ACCESSIBILITY ENGINE
// ==========================================
export interface InvoiceFilters {
  search?: string;
  startDate?: number;
  endDate?: number;
  status?: "ALL" | "COMPLETED" | "PARTIALLY_RETURNED" | "FULLY_RETURNED" | "CANCELLED";
  paymentMethod?: "ALL" | "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT";
  paymentStatus?: "ALL" | "PAID" | "PARTIALLY_PAID" | "CREDIT";
  shopId?: string;
  cashierId?: string;
}

export interface InvoicesQueryResult {
  invoices: Sale[];
  itemsBySaleId: Record<string, SaleItem[]>;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getSales(shopId?: string): Sale[] {
  const store = loadLocalStore();
  if (!shopId || shopId === "ALL") return store.sales;
  return store.sales.filter((s) => s.shopId === shopId);
}

/**
 * Retrieves invoices strictly filtered by user role and filters.
 * CASHIER and SHOP_MANAGER can ONLY view invoices where cashierId === user.uid.
 * SUPER_ADMIN can view all sales across all cashiers and outlets.
 */
export function getInvoicesForUser(
  user: UserProfile,
  filters: InvoiceFilters = {},
  page: number = 1,
  pageSize: number = 50
): InvoicesQueryResult {
  if (!user) {
    return { invoices: [], itemsBySaleId: {}, totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }

  // Security enforcement at data layer:
  // If a Cashier or Shop Manager tries to pass another cashierId filter, reject and return empty
  if (user.role !== "SUPER_ADMIN" && filters.cashierId && filters.cashierId !== user.uid) {
    return { invoices: [], itemsBySaleId: {}, totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }

  const store = loadLocalStore();
  let sales = [...store.sales];

  // 1. Enforce Role Visibility
  if (user.role === "CASHIER" || user.role === "SHOP_MANAGER") {
    sales = sales.filter((s) => s.cashierId === user.uid);
  } else if (user.role === "SUPER_ADMIN") {
    if (filters.cashierId && filters.cashierId !== "ALL") {
      sales = sales.filter((s) => s.cashierId === filters.cashierId);
    }
    if (filters.shopId && filters.shopId !== "ALL") {
      sales = sales.filter((s) => s.shopId === filters.shopId);
    }
  }

  // 2. Date Range Filter
  if (filters.startDate !== undefined) {
    sales = sales.filter((s) => s.createdAt >= filters.startDate!);
  }
  if (filters.endDate !== undefined) {
    sales = sales.filter((s) => s.createdAt <= filters.endDate!);
  }

  // 3. Status Filter
  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "COMPLETED") {
      sales = sales.filter((s) => s.status === "COMPLETED" && (s.returnStatus === "NONE" || !s.returnStatus));
    } else if (filters.status === "PARTIALLY_RETURNED") {
      sales = sales.filter((s) => s.returnStatus === "PARTIALLY_RETURNED");
    } else if (filters.status === "FULLY_RETURNED") {
      sales = sales.filter((s) => s.returnStatus === "FULLY_RETURNED");
    } else if (filters.status === "CANCELLED") {
      sales = sales.filter((s) => s.status === "CANCELLED");
    }
  }

  // 4. Payment Method & Status Filter (Section 5.7)
  if (filters.paymentMethod && filters.paymentMethod !== "ALL") {
    sales = sales.filter((s) => s.payments?.some((p) => p.method === filters.paymentMethod));
  }
  if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
    sales = sales.filter((s) => s.paymentStatus === filters.paymentStatus);
  }

  // 5. Search Filter (Partial invoice #, customer name, customer phone, exact total)
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    const cleanNum = parseFloat(q.replace(/[^0-9.]/g, ""));
    const hasNum = !isNaN(cleanNum) && cleanNum > 0;

    sales = sales.filter((s) => {
      const matchInv = s.invoiceNumber.toLowerCase().includes(q);
      const matchCust = s.customerName ? s.customerName.toLowerCase().includes(q) : false;
      const matchPhone = s.customerPhone ? s.customerPhone.includes(q) : false;
      const matchAmount = hasNum && Math.abs(s.total - cleanNum) < 0.01;
      return matchInv || matchCust || matchPhone || matchAmount;
    });
  }

  // Sort: newest first
  sales.sort((a, b) => b.createdAt - a.createdAt);

  const totalCount = sales.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const paginatedSales = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const itemsBySaleId: Record<string, SaleItem[]> = {};
  for (const s of paginatedSales) {
    itemsBySaleId[s.id] = store.saleItems.filter((i) => i.saleId === s.id);
  }

  return {
    invoices: paginatedSales,
    itemsBySaleId,
    totalCount,
    page: currentPage,
    pageSize,
    totalPages,
  };
}

export function logInvoiceReprint(user: UserProfile, sale: Sale): void {
  const store = loadLocalStore();
  logAuditAction(store, {
    userId: user.uid,
    userEmailCache: user.displayName,
    action: "INVOICE_REPRINT_DUPLICATE",
    entityType: "sales",
    entityId: sale.id,
    shopId: sale.shopId,
    reason: `Reprinted invoice ${sale.invoiceNumber} marked DUPLICATE`,
  });
  saveLocalStore(store);
}

// ==========================================
// 7. CUSTOMER RETURNS & SIZE EXCHANGES
// ==========================================
export function findSaleByInvoice(
  invoiceNumber: string,
  requestingUser?: UserProfile | null
): { sale: Sale; items: SaleItem[] } | null {
  const store = loadLocalStore();
  const sale = store.sales.find((s) => s.invoiceNumber.trim().toUpperCase() === invoiceNumber.trim().toUpperCase());
  if (!sale) return null;
  const items = store.saleItems.filter((i) => i.saleId === sale.id);

  // If a colleague looks up another staff member's invoice for return processing, audit log it (Decision D1)
  if (requestingUser && requestingUser.uid !== sale.cashierId) {
    logAuditAction(store, {
      userId: requestingUser.uid,
      userEmailCache: requestingUser.displayName,
      action: "RETURN_COLLEAGUE_INVOICE_LOOKUP",
      entityType: "sales",
      entityId: sale.id,
      shopId: sale.shopId,
      reason: `Looked up invoice ${sale.invoiceNumber} (issued by ${sale.cashierNameCache}) for return processing`,
    });
    saveLocalStore(store);
  }

  return { sale, items };
}

export async function processCustomerReturn(params: {
  shopId: string;
  originalSale: Sale;
  items: ReturnItem[];
  refundMethod: "CASH" | "ORIGINAL_CARD" | "STORE_CREDIT" | "EVEN_EXCHANGE";
  cashierId: string;
  shiftId?: string;
  notes?: string;
  approvedBy?: string;
  exchangeReplacement?: {
    variant: ProductVariant;
    quantity: number;
    price: number;
  };
}): Promise<CustomerReturn> {
  const store = loadLocalStore();

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
      netRefund = 0;
    } else {
      // Refund remaining difference
      netRefund = subtotalRefund - replacementTotal;
    }
    exchangeSaleId = `exc_sale_${Date.now()}`;
  }

  // Update original sale returnStatus & credit balance (Section 5.6 / Acceptance C5)
  const origSale = store.sales.find((s) => s.id === params.originalSale.id);
  if (origSale) {
    origSale.returnedAmount = (origSale.returnedAmount || 0) + subtotalRefund;
    origSale.returnStatus = origSale.returnedAmount >= origSale.total ? "FULLY_RETURNED" : "PARTIALLY_RETURNED";

    // If the returned invoice still has a balance due, the refund first reduces the unpaid balance
    if (origSale.balanceDue && origSale.balanceDue > 0) {
      const balanceReduction = Math.min(origSale.balanceDue, netRefund);
      origSale.balanceDue -= balanceReduction;
      origSale.paymentStatus = origSale.balanceDue === 0 ? "PAID" : "PARTIALLY_PAID";
      netRefund -= balanceReduction;

      if (origSale.customerId) {
        store.customerLedger.push({
          id: `cled_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          customerId: origSale.customerId,
          shopId: params.shopId,
          type: "RETURN_ADJUSTMENT",
          amount: balanceReduction,
          direction: "CREDIT",
          saleId: origSale.id,
          referenceNumber: returnNumber,
          method: "CREDIT",
          note: `Return balance adjustment against invoice #${origSale.invoiceNumber}`,
          createdBy: params.cashierId,
          createdAt: Date.now(),
        });
      }
    }
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
    userEmailCache: "Cashier",
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
// 6B. CUSTOMERS, CREDIT & LEDGER MANAGEMENT (WP5)
// ==========================================

export function getCustomers(query?: string, activeOnly: boolean = false): Customer[] {
  const store = loadLocalStore();
  let list = store.customers || [];
  if (activeOnly) {
    list = list.filter((c) => c.active);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomerById(id: string): Customer | undefined {
  const store = loadLocalStore();
  return (store.customers || []).find((c) => c.id === id);
}

export function getCustomerByPhone(phone: string): Customer | undefined {
  const store = loadLocalStore();
  const clean = phone.trim().toLowerCase();
  return (store.customers || []).find((c) => c.phone.trim().toLowerCase() === clean);
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  type: CustomerType;
  employeeId?: string;
  address?: string;
  creditLimit?: number;
  notes?: string;
  shopId?: string;
  active?: boolean;
  createdBy: string;
}): Promise<Customer> {
  const store = loadLocalStore();
  const cleanPhone = input.phone.trim();

  // Validate phone uniqueness
  const existing = (store.customers || []).find(
    (c) => c.phone.trim().toLowerCase() === cleanPhone.toLowerCase()
  );
  if (existing) {
    throw new Error(`A customer with phone number ${cleanPhone} already exists (${existing.name}).`);
  }

  const customerId = `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newCustomer: Customer = {
    id: customerId,
    name: input.name.trim(),
    phone: cleanPhone,
    type: input.type || "REGULAR",
    employeeId: input.employeeId?.trim() || undefined,
    address: input.address?.trim() || undefined,
    creditLimit: input.creditLimit !== undefined ? Number(input.creditLimit) : undefined,
    notes: input.notes?.trim() || undefined,
    active: input.active !== undefined ? input.active : true,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };

  if (!store.customers) store.customers = [];
  store.customers.push(newCustomer);

  logAuditAction(store, {
    userId: input.createdBy,
    userEmailCache: "Staff",
    action: "CUSTOMER_CREATE",
    entityType: "customers",
    entityId: customerId,
    after: newCustomer,
    reason: `Created ${newCustomer.type} customer: ${newCustomer.name}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "customers", customerId), newCustomer);
  } catch (e) {
    console.warn("Firestore sync customer create error:", e);
  }

  return newCustomer;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
  userId: string
): Promise<Customer> {
  const store = loadLocalStore();
  const customer = (store.customers || []).find((c) => c.id === id);
  if (!customer) throw new Error("Customer not found.");

  const callingUser = store.users.find((u) => u.uid === userId);

  // If changing credit limit, enforce customers.manage permission (Super Admin only)
  if (updates.creditLimit !== undefined && updates.creditLimit !== customer.creditLimit) {
    if (!callingUser || !can(callingUser, "customers.manage")) {
      throw new Error("Only Super Admin can modify credit limits.");
    }
  }

  // If updating phone, check uniqueness
  if (updates.phone && updates.phone.trim().toLowerCase() !== customer.phone.toLowerCase()) {
    const cleanPhone = updates.phone.trim().toLowerCase();
    const duplicate = (store.customers || []).find(
      (c) => c.id !== id && c.phone.trim().toLowerCase() === cleanPhone
    );
    if (duplicate) {
      throw new Error(`Another customer with phone ${updates.phone} already exists (${duplicate.name}).`);
    }
  }

  const before = { ...customer };
  Object.assign(customer, {
    ...updates,
    updatedAt: Date.now(),
  });

  logAuditAction(store, {
    userId,
    userEmailCache: callingUser?.displayName || "Staff",
    action: "CUSTOMER_UPDATE",
    entityType: "customers",
    entityId: id,
    before,
    after: customer,
    reason: `Updated customer details for ${customer.name}`,
  });

  saveLocalStore(store);

  try {
    await updateDoc(doc(db, "customers", id), customer);
  } catch (e) {
    console.warn("Firestore sync customer update error:", e);
  }

  return customer;
}

export function getCustomerLedger(customerId: string): CustomerLedgerEntry[] {
  const store = loadLocalStore();
  return (store.customerLedger || [])
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Derived Customer Balance: Strictly sum of DEBITs minus sum of CREDITs
 * Acceptance C7: Balance equals sum of ledger entries.
 */
export function getCustomerBalance(customerId: string): number {
  const store = loadLocalStore();
  const entries = (store.customerLedger || []).filter((e) => e.customerId === customerId);
  return entries.reduce((bal, e) => {
    if (e.direction === "DEBIT") return bal + e.amount;
    if (e.direction === "CREDIT") return bal - e.amount;
    return bal;
  }, 0);
}

export function getCustomerCreditInvoices(customerId: string): Sale[] {
  const store = loadLocalStore();
  return (store.sales || [])
    .filter(
      (s) =>
        s.customerId === customerId &&
        s.balanceDue > 0 &&
        s.status === "COMPLETED"
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getCustomerAgedBreakdown(customerId: string): {
  d30: number;
  d60: number;
  d90: number;
  d90Plus: number;
  total: number;
} {
  const store = loadLocalStore();
  const unpaidSales = (store.sales || []).filter(
    (s) => s.customerId === customerId && s.balanceDue > 0 && s.status === "COMPLETED"
  );

  const now = Date.now();
  let d30 = 0;
  let d60 = 0;
  let d90 = 0;
  let d90Plus = 0;

  for (const s of unpaidSales) {
    const days = Math.floor((now - s.createdAt) / 86400000);
    if (days <= 30) {
      d30 += s.balanceDue;
    } else if (days <= 60) {
      d60 += s.balanceDue;
    } else if (days <= 90) {
      d90 += s.balanceDue;
    } else {
      d90Plus += s.balanceDue;
    }
  }

  const total = d30 + d60 + d90 + d90Plus;
  return { d30, d60, d90, d90Plus, total };
}

/**
 * Receives customer payment and settles oldest unpaid credit invoices first (FIFO).
 * Section 5.4 / Acceptance C3
 */
export async function receiveCustomerPayment(params: {
  customerId: string;
  shopId: string;
  amount: number;
  method: "CASH" | "CARD" | "BANK_TRANSFER";
  reference?: string;
  note?: string;
  receivedBy: string;
  receivedByName: string;
}): Promise<CustomerPaymentReceipt> {
  const store = loadLocalStore();
  const caller = store.users.find((u) => u.uid === params.receivedBy);
  if (caller && !can(caller, "customers.payment.receive")) {
    throw new Error("You do not have permission to receive customer payments.");
  }

  if (params.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const customer = (store.customers || []).find((c) => c.id === params.customerId);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const shop = store.shops.find((s) => s.id === params.shopId);
  const payPrefix = shop?.code ? `${shop.code}-PAY` : params.shopId === "rightway" ? "RW-PAY" : "MG-PAY";
  const paymentNumber = getNextSequentialNumber(payPrefix, `${params.shopId}_pay`);

  // FIFO Allocation against oldest unpaid invoices
  const unpaidSales = (store.sales || [])
    .filter((s) => s.customerId === params.customerId && s.balanceDue > 0 && s.status === "COMPLETED")
    .sort((a, b) => a.createdAt - b.createdAt);

  let unallocated = params.amount;
  const settledInvoices: SettledInvoiceRecord[] = [];

  for (const sale of unpaidSales) {
    if (unallocated <= 0) break;
    const applied = Math.min(unallocated, sale.balanceDue);
    sale.amountPaid += applied;
    sale.balanceDue -= applied;
    sale.paymentStatus = sale.balanceDue === 0 ? "PAID" : "PARTIALLY_PAID";
    unallocated -= applied;

    settledInvoices.push({
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      amountApplied: applied,
      balanceRemaining: sale.balanceDue,
    });
  }

  // Append Payment Received to Customer Ledger (Credit decreases debt)
  const ledgerEntry: CustomerLedgerEntry = {
    id: `cled_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    customerId: customer.id,
    shopId: params.shopId,
    type: "PAYMENT_RECEIVED",
    amount: params.amount,
    direction: "CREDIT",
    referenceNumber: paymentNumber,
    method: params.method,
    note:
      params.note ||
      (settledInvoices.length > 0
        ? `Settled invoices: ${settledInvoices.map((s) => s.invoiceNumber).join(", ")}`
        : "Payment on account"),
    createdBy: params.receivedBy,
    createdAt: Date.now(),
  };

  if (!store.customerLedger) store.customerLedger = [];
  store.customerLedger.push(ledgerEntry);

  const receipt: CustomerPaymentReceipt = {
    id: `payrec_${Date.now()}`,
    paymentNumber,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    shopId: params.shopId,
    amount: params.amount,
    method: params.method,
    reference: params.reference,
    note: params.note,
    settledInvoices,
    receivedBy: params.receivedBy,
    receivedByName: params.receivedByName,
    createdAt: Date.now(),
  };

  if (!store.customerPayments) store.customerPayments = [];
  store.customerPayments.push(receipt);

  logAuditAction(store, {
    userId: params.receivedBy,
    userEmailCache: params.receivedByName,
    action: "CUSTOMER_PAYMENT_RECEIVE",
    entityType: "customerPayments",
    entityId: receipt.id,
    shopId: params.shopId,
    after: receipt,
    reason: `Received payment ${paymentNumber} of Rs. ${params.amount} from ${customer.name}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "customerPayments", receipt.id), receipt);
  } catch (e) {
    console.warn("Firestore sync payment receipt error:", e);
  }

  return receipt;
}

/**
 * Issues cash advance (credit as cash) to staff or customer.
 * Super Admin only! (Section 5.5 / Acceptance C6)
 */
export async function issueCashAdvance(params: {
  customerId: string;
  shopId: string;
  amount: number;
  date?: number;
  note?: string;
  issuedBy: string;
  issuedByName: string;
}): Promise<CashAdvanceReceipt> {
  const store = loadLocalStore();
  const caller = store.users.find((u) => u.uid === params.issuedBy);
  if (!caller || !can(caller, "customers.cash_advance")) {
    throw new Error("Only Super Admin can issue cash advances.");
  }

  if (params.amount <= 0) {
    throw new Error("Advance amount must be greater than zero.");
  }

  const customer = (store.customers || []).find((c) => c.id === params.customerId);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const shop = store.shops.find((s) => s.id === params.shopId);
  const advPrefix = shop?.code ? `${shop.code}-ADV` : params.shopId === "rightway" ? "RW-ADV" : "MG-ADV";
  const voucherNumber = getNextSequentialNumber(advPrefix, `${params.shopId}_adv`);

  // Debit increases customer balance (debt)
  const ledgerEntry: CustomerLedgerEntry = {
    id: `cled_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    customerId: customer.id,
    shopId: params.shopId,
    type: "CASH_ADVANCE",
    amount: params.amount,
    direction: "DEBIT",
    referenceNumber: voucherNumber,
    method: "CASH",
    note: params.note || "Cash advance issued",
    createdBy: params.issuedBy,
    createdAt: params.date || Date.now(),
  };

  if (!store.customerLedger) store.customerLedger = [];
  store.customerLedger.push(ledgerEntry);

  const voucher: CashAdvanceReceipt = {
    id: `advrec_${Date.now()}`,
    voucherNumber,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    shopId: params.shopId,
    amount: params.amount,
    date: params.date || Date.now(),
    note: params.note,
    issuedBy: params.issuedBy,
    issuedByName: params.issuedByName,
    createdAt: Date.now(),
  };

  if (!store.cashAdvances) store.cashAdvances = [];
  store.cashAdvances.push(voucher);

  logAuditAction(store, {
    userId: params.issuedBy,
    userEmailCache: params.issuedByName,
    action: "CUSTOMER_CASH_ADVANCE",
    entityType: "cashAdvances",
    entityId: voucher.id,
    shopId: params.shopId,
    after: voucher,
    reason: `Issued cash advance ${voucherNumber} of Rs. ${params.amount} to ${customer.name}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "cashAdvances", voucher.id), voucher);
  } catch (e) {
    console.warn("Firestore sync cash advance error:", e);
  }

  return voucher;
}

/**
 * Adjust or write-off customer balance.
 * Super Admin only! (Section 5.3 / Acceptance C6)
 */
export async function adjustCustomerBalance(params: {
  customerId: string;
  shopId: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  reason: string;
  userId: string;
  isWriteOff?: boolean;
}): Promise<void> {
  const store = loadLocalStore();
  const caller = store.users.find((u) => u.uid === params.userId);
  if (!caller || !can(caller, "customers.manage")) {
    throw new Error("Only Super Admin can adjust or write off customer balances.");
  }

  if (params.amount <= 0) {
    throw new Error("Adjustment amount must be greater than zero.");
  }

  const customer = (store.customers || []).find((c) => c.id === params.customerId);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const ledgerEntry: CustomerLedgerEntry = {
    id: `cled_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    customerId: customer.id,
    shopId: params.shopId,
    type: params.isWriteOff ? "WRITE_OFF" : "ADJUSTMENT",
    amount: params.amount,
    direction: params.direction,
    referenceNumber: params.isWriteOff ? "WRITE-OFF" : "ADJUST",
    method: "ADJUSTMENT",
    note: params.reason,
    createdBy: params.userId,
    createdAt: Date.now(),
  };

  if (!store.customerLedger) store.customerLedger = [];
  store.customerLedger.push(ledgerEntry);

  logAuditAction(store, {
    userId: params.userId,
    userEmailCache: caller.displayName,
    action: params.isWriteOff ? "CUSTOMER_WRITE_OFF" : "CUSTOMER_ADJUSTMENT",
    entityType: "customers",
    entityId: customer.id,
    shopId: params.shopId,
    after: ledgerEntry,
    reason: `${params.isWriteOff ? "Write-off" : "Balance adjustment"} of Rs. ${params.amount} (${params.direction}): ${params.reason}`,
  });

  saveLocalStore(store);
}

export function getAllOutstandingCreditCustomers(): {
  customer: Customer;
  balance: number;
  aged: { d30: number; d60: number; d90: number; d90Plus: number; total: number };
}[] {
  const store = loadLocalStore();
  const customers = store.customers || [];
  const results: {
    customer: Customer;
    balance: number;
    aged: { d30: number; d60: number; d90: number; d90Plus: number; total: number };
  }[] = [];

  for (const c of customers) {
    const balance = getCustomerBalance(c.id);
    if (balance > 0) {
      const aged = getCustomerAgedBreakdown(c.id);
      results.push({ customer: c, balance, aged });
    }
  }

  return results.sort((a, b) => b.balance - a.balance);
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
  intakeShiftId?: string;
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

  store.repairs.push(repair);
  logAuditAction(store, {
    userId: params.intakeCashierId,
    userEmailCache: "Cashier",
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
  deliveryShiftId?: string;
  deliveryPaymentMethod: "CASH" | "CARD" | "BANK_TRANSFER";
}): Promise<ShoeRepairOrder> {
  const store = loadLocalStore();
  const repair = store.repairs.find((r) => r.id === params.repairId);
  if (!repair) throw new Error("Repair order not found");

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

  logAuditAction(store, {
    userId: params.deliveryCashierId,
    userEmailCache: "Cashier",
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

export interface QuickTransferParams {
  fromShopId: string;
  toShopId: string;
  items: { variantId: string; quantity: number }[];
  userId: string;
  userName: string;
  notes?: string;
  idempotencyKey?: string;
}

export async function quickTransferStock(params: QuickTransferParams): Promise<StockTransfer> {
  const store = loadLocalStore();
  const caller = store.users.find((u) => u.uid === params.userId);

  if (caller && !can(caller, "transfers.quick")) {
    throw new Error("You do not have permission to execute quick transfers.");
  }
  if (caller?.role === "CASHIER" && caller.allowedShopIds && !caller.allowedShopIds.includes(params.fromShopId)) {
    throw new Error("Cashiers can only transfer stock from their own branch.");
  }

  if (params.fromShopId === params.toShopId) {
    throw new Error("Origin and destination branches must be different.");
  }

  if (!params.items || params.items.length === 0) {
    throw new Error("At least one product variant must be selected for transfer.");
  }

  // Idempotency check: if transfer with this key already exists, return it
  if (params.idempotencyKey) {
    const existing = store.transfers.find((t) => t.idempotencyKey === params.idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  // Validate quantities and source stock availability for all items
  for (const it of params.items) {
    if (!it.quantity || it.quantity <= 0) {
      throw new Error("Transfer quantity must be greater than zero.");
    }
    const srcInvKey = `${params.fromShopId}_${it.variantId}`;
    const onHand = store.inventory[srcInvKey]?.quantityOnHand || 0;
    if (onHand < it.quantity) {
      const variant = store.variants.find((v) => v.id === it.variantId);
      const name = variant ? variant.productNameCache : it.variantId;
      throw new Error(`Insufficient stock for ${name} at origin branch. Available: ${onHand}, Requested: ${it.quantity}`);
    }
  }

  const transferNumber = getNextSequentialNumber("TRF", "transfer");
  const transferId = params.idempotencyKey ? `trf_${params.idempotencyKey}` : `trf_${Date.now()}`;
  const transferItems: StockTransferItem[] = [];
  let totalQuantity = 0;
  const now = Date.now();

  // Atomic operation: deduct source, add destination, record movements
  for (const it of params.items) {
    const v = store.variants.find((item) => item.id === it.variantId);
    const desc = v
      ? `${v.productNameCache} - ${v.colorNameCache} - ${v.sizeLabelCache}`
      : it.variantId;

    // Source shop deduction
    const srcInvKey = `${params.fromShopId}_${it.variantId}`;
    const srcBefore = store.inventory[srcInvKey].quantityOnHand;
    const srcAfter = srcBefore - it.quantity;
    store.inventory[srcInvKey].quantityOnHand = srcAfter;
    store.inventory[srcInvKey].lastMovementAt = now;

    store.movements.push({
      id: `mvt_${now}_trf_out_${it.variantId}_${Math.random().toString(36).substring(2, 7)}`,
      shopId: params.fromShopId,
      variantId: it.variantId,
      productId: v?.productId || "",
      type: "TRANSFER_OUT",
      quantity: it.quantity,
      direction: "OUT",
      quantityBefore: srcBefore,
      quantityAfter: srcAfter,
      referenceType: "TRANSFER",
      referenceId: transferId,
      userId: params.userId,
      createdAt: now,
    });

    // Destination shop addition (create inventory record if non-existent)
    const destInvKey = `${params.toShopId}_${it.variantId}`;
    if (!store.inventory[destInvKey]) {
      store.inventory[destInvKey] = {
        id: destInvKey,
        shopId: params.toShopId,
        variantId: it.variantId,
        productId: v?.productId || "",
        quantityOnHand: 0,
        reorderLevel: 2,
        lastMovementAt: now,
      };
    }
    const destBefore = store.inventory[destInvKey].quantityOnHand;
    const destAfter = destBefore + it.quantity;
    store.inventory[destInvKey].quantityOnHand = destAfter;
    store.inventory[destInvKey].lastMovementAt = now;

    store.movements.push({
      id: `mvt_${now}_trf_in_${it.variantId}_${Math.random().toString(36).substring(2, 7)}`,
      shopId: params.toShopId,
      variantId: it.variantId,
      productId: v?.productId || "",
      type: "TRANSFER_IN",
      quantity: it.quantity,
      direction: "IN",
      quantityBefore: destBefore,
      quantityAfter: destAfter,
      referenceType: "TRANSFER",
      referenceId: transferId,
      userId: params.userId,
      createdAt: now,
    });

    transferItems.push({
      variantId: it.variantId,
      productId: v?.productId || "",
      dispatchedQuantity: it.quantity,
      receivedQuantity: it.quantity,
      variantDescriptionCache: desc,
    });
    totalQuantity += it.quantity;
  }

  const transfer: StockTransfer = {
    id: transferId,
    transferNumber,
    sourceShopId: params.fromShopId,
    destinationShopId: params.toShopId,
    status: "RECEIVED",
    mode: "QUICK",
    items: transferItems,
    totalQuantity,
    dispatchedBy: params.userName || params.userId,
    dispatchedAt: now,
    receivedBy: params.userName || params.userId,
    receivedAt: now,
    notes: params.notes || null,
    idempotencyKey: params.idempotencyKey || null,
  };

  store.transfers.push(transfer);

  logAuditAction(store, {
    userId: params.userId,
    userEmailCache: params.userName || "Cashier",
    action: "TRANSFER_QUICK",
    entityType: "stockTransfers",
    entityId: transferId,
    shopId: params.fromShopId,
    after: transfer,
    reason: `Quick transfer ${transferNumber} of ${totalQuantity} pairs from ${params.fromShopId} to ${params.toShopId}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "stockTransfers", transferId), transfer);
  } catch (e) {
    console.warn("Firestore sync quick transfer error:", e);
  }

  return transfer;
}

export interface StockCheckRow {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string;
  categoryName: string;
  productType?: string;
  gender?: string;
  colorName: string;
  sizeLabel: string;
  sku: string;
  barcode: string;
  sellingPrice: number;
  thisBranchStock: number;
  otherBranchStock: number;
  totalStock: number;
  reorderLevel: number;
}

export function getStockCheckRows(thisShopId: string, otherShopId: string): StockCheckRow[] {
  const store = loadLocalStore();
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));
  const brandMap = new Map(store.brands.map((b) => [b.id, b.name]));
  const productMap = new Map(store.products.map((p) => [p.id, p]));

  return store.variants
    .filter((v) => v.active !== false)
    .map((v) => {
      const p = productMap.get(v.productId);
      const thisInv = store.inventory[`${thisShopId}_${v.id}`]?.quantityOnHand || 0;
      const otherInv = store.inventory[`${otherShopId}_${v.id}`]?.quantityOnHand || 0;
      const reorder = store.inventory[`${thisShopId}_${v.id}`]?.reorderLevel ?? 2;

      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.productNameCache,
        brandName: v.brandNameCache || (p ? brandMap.get(p.brandId) || "" : ""),
        categoryName: p ? catMap.get(p.categoryId) || "" : "",
        productType: v.productType || p?.productType || "FOOTWEAR",
        gender: p?.gender,
        colorName: v.colorNameCache,
        sizeLabel: v.sizeLabelCache,
        sku: v.sku,
        barcode: v.barcode,
        sellingPrice: v.sellingPrice,
        thisBranchStock: thisInv,
        otherBranchStock: otherInv,
        totalStock: thisInv + otherInv,
        reorderLevel: reorder,
      };
    });
}

export interface CentralStockRow {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string;
  categoryName: string;
  productType?: string;
  gender?: string;
  colorName: string;
  sizeLabel: string;
  sku: string;
  barcode: string;
  sellingPrice: number;
  referenceCostPrice: number;
  rightWayStock: number;
  megaStock: number;
  totalStock: number;
  reorderLevel: number;
  retailValuation: number;
  costValuation: number;
}

export interface CentralStockReport {
  rows: CentralStockRow[];
  totalUnits: number;
  rightWayUnits: number;
  megaUnits: number;
  totalRetailValuation: number;
  totalCostValuation: number;
}

export function getCentralStockReport(callingUser?: { role: string } | null): CentralStockReport {
  if (callingUser && callingUser.role !== "SUPER_ADMIN") {
    throw new Error("Permission denied: Central stock report is restricted to Super Admin.");
  }

  const store = loadLocalStore();
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));
  const brandMap = new Map(store.brands.map((b) => [b.id, b.name]));
  const productMap = new Map(store.products.map((p) => [p.id, p]));

  let totalUnits = 0;
  let rightWayUnits = 0;
  let megaUnits = 0;
  let totalRetailValuation = 0;
  let totalCostValuation = 0;

  const rows: CentralStockRow[] = store.variants
    .filter((v) => v.active !== false)
    .map((v) => {
      const p = productMap.get(v.productId);
      const rwStock = store.inventory[`rightway_${v.id}`]?.quantityOnHand || 0;
      const megaStock = store.inventory[`mega_${v.id}`]?.quantityOnHand || 0;
      const totalStock = rwStock + megaStock;
      const reorderLevel = Math.max(
        store.inventory[`rightway_${v.id}`]?.reorderLevel ?? 2,
        store.inventory[`mega_${v.id}`]?.reorderLevel ?? 2
      );
      const cost = v.referenceCostPrice || 0;
      const price = v.sellingPrice || 0;
      const retailValuation = totalStock * price;
      const costValuation = totalStock * cost;

      totalUnits += totalStock;
      rightWayUnits += rwStock;
      megaUnits += megaStock;
      totalRetailValuation += retailValuation;
      totalCostValuation += costValuation;

      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.productNameCache,
        brandName: v.brandNameCache || (p ? brandMap.get(p.brandId) || "" : ""),
        categoryName: p ? catMap.get(p.categoryId) || "" : "",
        productType: v.productType || p?.productType || "FOOTWEAR",
        gender: p?.gender,
        colorName: v.colorNameCache,
        sizeLabel: v.sizeLabelCache,
        sku: v.sku,
        barcode: v.barcode,
        sellingPrice: price,
        referenceCostPrice: cost,
        rightWayStock: rwStock,
        megaStock: megaStock,
        totalStock,
        reorderLevel,
        retailValuation,
        costValuation,
      };
    });

  return {
    rows,
    totalUnits,
    rightWayUnits,
    megaUnits,
    totalRetailValuation,
    totalCostValuation,
  };
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
// 10. PURCHASING & SUPPLIER LEDGER (WP7)
// ==========================================
export function getPurchases(
  shopId?: string,
  callingUser?: UserProfile | { role: UserRole; id?: string; displayName?: string } | null
): Purchase[] {
  const store = loadLocalStore();
  let list = [...store.purchases];

  if (shopId) {
    list = list.filter((p) => p.shopId === shopId);
  }

  // Section 7.1 / U7: Cashiers see own bills only
  if (callingUser && callingUser.role === "CASHIER") {
    list = list.filter(
      (p) =>
        p.receivedBy === callingUser.id ||
        p.createdByNameCache === callingUser.displayName ||
        p.receivedBy === callingUser.displayName
    );
  }

  return list.sort((a, b) => (b.invoiceDate || b.receivedAt) - (a.invoiceDate || a.receivedAt));
}

export function getSupplierLedger(
  supplierId: string,
  callingUser?: UserProfile | { role: UserRole } | null
): {
  transactions: SupplierTransaction[];
  outstandingBalance: number;
} {
  // Section 7.1 / U4: Cashiers cannot open or view supplier ledger
  if (callingUser && callingUser.role === "CASHIER") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

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

export interface CreatePurchaseParams {
  shopId: string;
  supplierId: string;
  supplierBillNumber?: string;
  invoiceDate?: number;
  items: {
    variant: ProductVariant;
    quantity: number;
    unitCost: number;
    listPrice?: number;
  }[];
  notes?: string;
  paymentMethod: "CASH" | "CHEQUE" | "CREDIT" | "BANK_TRANSFER" | "PARTIAL";
  paidAmount?: number;
  chequeDetails?: {
    chequeNumber: string;
    bankName: string;
    chequeDate: number;
  };
  callingUser: UserProfile | { id: string; role: UserRole; displayName?: string; allowedShopIds?: string[] };
}

export async function createPurchase(params: CreatePurchaseParams): Promise<{ purchase: Purchase; cheque?: Cheque }> {
  const store = loadLocalStore();
  const supplier = store.suppliers.find((s) => s.id === params.supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const isSuperAdmin = params.callingUser.role === "SUPER_ADMIN";
  const isCashier = params.callingUser.role === "CASHIER";

  // Branch check: Cashier can only purchase for their allowed shop
  if (!isSuperAdmin && params.callingUser.allowedShopIds && !params.callingUser.allowedShopIds.includes(params.shopId)) {
    throw new Error(ERROR_MESSAGES.OUTLET_NOT_ALLOWED);
  }

  // Section 7.4 / U6: Cashiers can only choose Cash or Cheque
  if (!isSuperAdmin && params.paymentMethod !== "CASH" && params.paymentMethod !== "CHEQUE") {
    throw new Error("Cashiers can only purchase with Cash or Cheque.");
  }

  if (params.items.length === 0) {
    throw new Error("Purchase must have at least one line item.");
  }

  // Duplicate cheque number check
  if (params.paymentMethod === "CHEQUE") {
    if (!params.chequeDetails?.chequeNumber || !params.chequeDetails?.bankName) {
      throw new Error("Cheque number and bank name are required for cheque payment.");
    }
    const chqNorm = params.chequeDetails.chequeNumber.trim().toLowerCase();
    const existing = store.cheques.some((c) => c.chequeNumber.trim().toLowerCase() === chqNorm);
    if (existing) {
      throw new Error("This cheque number is already used.");
    }
  }

  const purchaseNumber = getNextSequentialNumber("PUR", "purchase");
  const purchaseId = `pur_${Date.now()}`;

  const purchaseItems: PurchaseItem[] = [];
  let totalAmount = 0;
  let costVarianceFlagged = false;
  const varianceThreshold = (store.settings.costVarianceThresholdPercent || 25) / 100;

  for (const it of params.items) {
    if (it.quantity <= 0) throw new Error("Quantity must be greater than zero.");
    if (it.unitCost < 0) throw new Error("Unit cost cannot be negative.");

    const lineTotal = it.quantity * it.unitCost;
    totalAmount += lineTotal;

    // Check cost variance against previous purchases of this variant
    let previousCost: number | null = null;
    for (const pastPur of store.purchases) {
      if (pastPur.status !== "CANCELLED") {
        const pastItem = pastPur.items.find((pi) => pi.variantId === it.variant.id);
        if (pastItem && pastItem.unitCost > 0) {
          previousCost = pastItem.unitCost;
          break;
        }
      }
    }
    if (previousCost === null && it.variant.referenceCostPrice > 0) {
      previousCost = it.variant.referenceCostPrice;
    }

    if (previousCost !== null && previousCost > 0) {
      const diff = Math.abs(it.unitCost - previousCost) / previousCost;
      if (diff > varianceThreshold) {
        costVarianceFlagged = true;
      }
    }

    // Inventory record & stock increment
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
      variantDescriptionCache: `${it.variant.productNameCache} - ${it.variant.colorNameCache} (${it.variant.sizeLabelCache})`,
      productType: it.variant.productType || "FOOTWEAR",
      brandNameCache: it.variant.brandNameCache,
      colorNameCache: it.variant.colorNameCache,
      sizeLabelCache: it.variant.sizeLabelCache,
      listPrice: it.variant.sellingPrice,
    });

    store.movements.push({
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_pur_${it.variant.id}`,
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
      userId: (params.callingUser as any).id || (params.callingUser as any).uid || "user",
      createdAt: Date.now(),
    });
  }

  const needsReview = isCashier || costVarianceFlagged;
  const paidAmount =
    params.paymentMethod === "CASH" || params.paymentMethod === "BANK_TRANSFER"
      ? totalAmount
      : params.paymentMethod === "PARTIAL"
      ? params.paidAmount || 0
      : 0;

  const purchase: Purchase = {
    id: purchaseId,
    purchaseNumber,
    shopId: params.shopId,
    supplierId: params.supplierId,
    supplierNameCache: supplier.name,
    supplierBillNumber: params.supplierBillNumber?.trim() || undefined,
    invoiceDate: params.invoiceDate || Date.now(),
    totalAmount,
    status: "RECEIVED",
    items: purchaseItems,
    receivedBy: (params.callingUser as any).id || (params.callingUser as any).uid || "user",
    createdByNameCache: params.callingUser.displayName || params.callingUser.role,
    createdByRoleCache: params.callingUser.role,
    receivedAt: Date.now(),
    notes: params.notes?.trim() || undefined,
    paymentMethod: params.paymentMethod,
    paidAmount,
    chequeDetails: params.chequeDetails
      ? {
          chequeNumber: params.chequeDetails.chequeNumber.trim(),
          bankName: params.chequeDetails.bankName.trim(),
          chequeDate: params.chequeDetails.chequeDate,
        }
      : undefined,
    needsReview,
    costVarianceFlagged,
  };

  store.purchases.push(purchase);

  // Supplier Ledger: Purchase increases liability
  const purchaseTx: SupplierTransaction = {
    id: `stx_${Date.now()}_pur`,
    supplierId: params.supplierId,
    shopId: params.shopId,
    date: params.invoiceDate || Date.now(),
    type: "PURCHASE",
    referenceId: purchaseId,
    referenceNumber: purchaseNumber,
    debit: 0,
    credit: totalAmount,
    balanceAfter: 0,
    notes: `Purchase Inward Bill #${purchaseNumber}`,
    createdAt: Date.now(),
  };
  store.supplierTransactions.push(purchaseTx);

  let createdCheque: Cheque | undefined;

  // Handle Payment
  if (params.paymentMethod === "CASH") {
    // Immediate Cash payment reduces liability
    const cashTx: SupplierTransaction = {
      id: `stx_${Date.now()}_pay`,
      supplierId: params.supplierId,
      shopId: params.shopId,
      date: params.invoiceDate || Date.now(),
      type: "PAYMENT",
      referenceId: purchaseId,
      referenceNumber: purchaseNumber,
      debit: totalAmount,
      credit: 0,
      balanceAfter: 0,
      notes: `Cash payment for Purchase #${purchaseNumber}`,
      createdAt: Date.now(),
    };
    store.supplierTransactions.push(cashTx);

    store.payments.push({
      id: `spay_${Date.now()}`,
      supplierId: params.supplierId,
      shopId: params.shopId,
      paymentNumber: getNextSequentialNumber("SPAY", "supplierPayment"),
      amount: totalAmount,
      paymentMethod: "CASH",
      reference: purchaseNumber,
      notes: `Cash payment for purchase #${purchaseNumber}`,
      createdAt: Date.now(),
    });
  } else if (params.paymentMethod === "CHEQUE") {
    const chqId = `chq_${Date.now()}`;
    createdCheque = {
      id: chqId,
      chequeNumber: params.chequeDetails!.chequeNumber.trim(),
      supplierId: params.supplierId,
      supplierNameCache: supplier.name,
      shopId: params.shopId,
      bankName: params.chequeDetails!.bankName.trim(),
      amount: totalAmount,
      issueDate: Date.now(),
      dueDate: params.chequeDetails!.chequeDate,
      clearedDate: null,
      status: "PENDING",
      purchaseId,
      purchaseNumber,
      issuedBy: (params.callingUser as any).id || (params.callingUser as any).uid || "user",
      issuedByName: params.callingUser.displayName || "Cashier",
      needsReview: isCashier,
      history: [
        {
          from: "NEW",
          to: "PENDING",
          at: Date.now(),
          by: params.callingUser.displayName || "Cashier",
          reason: `Cheque issued for purchase ${purchaseNumber}`,
        },
      ],
      createdAt: Date.now(),
    };
    store.cheques.push(createdCheque);
  } else if (params.paymentMethod === "BANK_TRANSFER") {
    const bankTx: SupplierTransaction = {
      id: `stx_${Date.now()}_pay`,
      supplierId: params.supplierId,
      shopId: params.shopId,
      date: params.invoiceDate || Date.now(),
      type: "PAYMENT",
      referenceId: purchaseId,
      referenceNumber: purchaseNumber,
      debit: totalAmount,
      credit: 0,
      balanceAfter: 0,
      notes: `Bank transfer payment for Purchase #${purchaseNumber}`,
      createdAt: Date.now(),
    };
    store.supplierTransactions.push(bankTx);
  } else if (params.paymentMethod === "PARTIAL" && paidAmount > 0) {
    const partialTx: SupplierTransaction = {
      id: `stx_${Date.now()}_pay`,
      supplierId: params.supplierId,
      shopId: params.shopId,
      date: params.invoiceDate || Date.now(),
      type: "PAYMENT",
      referenceId: purchaseId,
      referenceNumber: purchaseNumber,
      debit: paidAmount,
      credit: 0,
      balanceAfter: 0,
      notes: `Partial payment for Purchase #${purchaseNumber}`,
      createdAt: Date.now(),
    };
    store.supplierTransactions.push(partialTx);
  }

  logAuditAction(store, {
    userId: (params.callingUser as any).id || (params.callingUser as any).uid || "user",
    userEmailCache: params.callingUser.displayName || params.callingUser.role,
    action: "PURCHASE_CREATE",
    entityType: "purchases",
    entityId: purchaseId,
    shopId: params.shopId,
    after: purchase,
    reason: `Created purchase ${purchaseNumber} for supplier ${supplier.name} via ${params.paymentMethod}${needsReview ? " (Needs review)" : ""}`,
  });

  saveLocalStore(store);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "purchases", purchaseId), purchase);
    batch.set(doc(db, "supplierTransactions", purchaseTx.id), purchaseTx);
    if (createdCheque) {
      batch.set(doc(db, "cheques", createdCheque.id), createdCheque);
    }
    await batch.commit();
  } catch (e) {
    console.warn("Firestore sync purchase error:", e);
  }

  return { purchase, cheque: createdCheque };
}

// Backwards-compatible wrapper
export async function createPurchaseOrder(params: {
  shopId: string;
  supplierId: string;
  items: { variant: ProductVariant; quantity: number; unitCost: number }[];
  receivedBy: string;
  notes?: string;
}): Promise<Purchase> {
  const res = await createPurchase({
    shopId: params.shopId,
    supplierId: params.supplierId,
    items: params.items,
    notes: params.notes,
    paymentMethod: "CASH",
    callingUser: {
      id: params.receivedBy,
      role: "SUPER_ADMIN",
      displayName: params.receivedBy,
    },
  });
  return res.purchase;
}

export async function markPurchaseReviewed(
  purchaseId: string,
  reviewedBy: UserProfile | { id: string; role: UserRole; displayName?: string },
  note?: string
): Promise<Purchase> {
  if (reviewedBy.role !== "SUPER_ADMIN") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

  const store = loadLocalStore();
  const purchase = store.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error("Purchase not found.");

  purchase.needsReview = false;
  purchase.reviewedBy = (reviewedBy as any).id || (reviewedBy as any).uid || "admin";
  purchase.reviewedAt = Date.now();
  purchase.reviewNote = note || null;

  logAuditAction(store, {
    userId: (reviewedBy as any).id || (reviewedBy as any).uid || "admin",
    userEmailCache: reviewedBy.displayName || "Super Admin",
    action: "PURCHASE_REVIEW",
    entityType: "purchases",
    entityId: purchaseId,
    shopId: purchase.shopId,
    after: purchase,
    reason: `Marked purchase ${purchase.purchaseNumber} as reviewed${note ? `: ${note}` : ""}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "purchases", purchaseId), purchase);
  } catch (e) {
    console.warn("Firestore sync purchase review error:", e);
  }

  return purchase;
}

export async function cancelPurchase(
  purchaseId: string,
  cancelledBy: UserProfile | { id: string; role: UserRole; displayName?: string },
  reason?: string
): Promise<Purchase> {
  if (cancelledBy.role !== "SUPER_ADMIN") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

  const store = loadLocalStore();
  const purchase = store.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.status === "CANCELLED") throw new Error("Purchase is already cancelled.");

  // Check inventory stock safeguard: cancelling cannot make stock negative
  for (const item of purchase.items) {
    const invKey = `${purchase.shopId}_${item.variantId}`;
    const curStock = store.inventory[invKey]?.quantityOnHand || 0;
    if (curStock - item.quantity < 0) {
      throw new Error(
        `Cannot cancel purchase: variant ${item.variantDescriptionCache} would have negative stock (${curStock - item.quantity}).`
      );
    }
  }

  // Deduct inventory
  for (const item of purchase.items) {
    const invKey = `${purchase.shopId}_${item.variantId}`;
    const beforeQty = store.inventory[invKey].quantityOnHand;
    const afterQty = beforeQty - item.quantity;
    store.inventory[invKey].quantityOnHand = afterQty;
    store.inventory[invKey].lastMovementAt = Date.now();

    store.movements.push({
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_pur_cancel_${item.variantId}`,
      shopId: purchase.shopId,
      variantId: item.variantId,
      productId: item.productId,
      type: "PURCHASE_CANCEL" as any,
      quantity: -item.quantity,
      direction: "OUT",
      quantityBefore: beforeQty,
      quantityAfter: afterQty,
      referenceType: "PURCHASE",
      referenceId: purchaseId,
      userId: (cancelledBy as any).id || (cancelledBy as any).uid || "admin",
      createdAt: Date.now(),
    });
  }

  // Reverse supplier ledger transaction
  const revTx: SupplierTransaction = {
    id: `stx_${Date.now()}_rev`,
    supplierId: purchase.supplierId,
    shopId: purchase.shopId,
    date: Date.now(),
    type: "ADJUSTMENT",
    referenceId: purchaseId,
    referenceNumber: `REV-${purchase.purchaseNumber}`,
    debit: purchase.totalAmount,
    credit: 0,
    balanceAfter: 0,
    notes: `Cancellation reversal for Purchase #${purchase.purchaseNumber}`,
    createdAt: Date.now(),
  };
  store.supplierTransactions.push(revTx);

  purchase.status = "CANCELLED";
  purchase.cancelledBy = (cancelledBy as any).id || (cancelledBy as any).uid || "admin";
  purchase.cancelledAt = Date.now();
  purchase.cancelReason = reason || "Cancelled by Super Admin";

  logAuditAction(store, {
    userId: (cancelledBy as any).id || (cancelledBy as any).uid || "admin",
    userEmailCache: cancelledBy.displayName || "Super Admin",
    action: "PURCHASE_CANCEL",
    entityType: "purchases",
    entityId: purchaseId,
    shopId: purchase.shopId,
    after: purchase,
    reason: `Cancelled purchase ${purchase.purchaseNumber}: ${reason || "No reason specified"}`,
  });

  saveLocalStore(store);

  try {
    await setDoc(doc(db, "purchases", purchaseId), purchase);
    await setDoc(doc(db, "supplierTransactions", revTx.id), revTx);
  } catch (e) {
    console.warn("Firestore sync purchase cancel error:", e);
  }

  return purchase;
}

// ==========================================
// 11. CHEQUES & SUPPLIER PAYMENTS (Super Admin Only!)
// ==========================================
export function getCheques(callingUser?: UserProfile | { role: UserRole } | null): Cheque[] {
  // Section 7.1 / U5: Cashier has no access to cheque list
  if (callingUser && callingUser.role === "CASHIER") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }
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
  password?: string;
  mustChangePassword?: boolean;
  linkedEmployeeId?: string;
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
    mustChangePassword: params.mustChangePassword ?? true,
    password: params.password,
    linkedEmployeeId: params.linkedEmployeeId,
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

  // Safety Guards: Cannot demote self or the last active Super Admin
  if (updates.role && updates.role !== user.role && user.role === "SUPER_ADMIN") {
    if (uid === updatedBy) {
      throw new Error("You cannot demote your own administrator account.");
    }
    const activeAdmins = store.users.filter((u) => u.role === "SUPER_ADMIN" && u.active);
    if (activeAdmins.length <= 1) {
      throw new Error(ERROR_MESSAGES.LAST_ADMIN);
    }
  }

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

  // Safety Guard: Cannot disable oneself
  if (!active && uid === updatedBy) {
    throw new Error("You cannot disable your own administrator account.");
  }

  // Safety Guard: Cannot disable last Super Admin (Rule T-14 & CR02)
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

// ==========================================
// 15. DAILY SALES & DAY-END STATUS AGGREGATIONS
// ==========================================

export interface DailySalesData {
  dateKey: string;
  dateDisplay: string;
  shopId: string;
  grossSales: number;
  itemDiscounts: number;
  billDiscounts: number;
  refunds: number;
  netSales: number;
  invoiceCount: number;
  payments: {
    cash: number;
    card: number;
    bankTransfer: number;
    credit: number;
    paymentsReceivedOnAccount: number;
  };
  repairIncome: number;
  dailyCashSummary?: DailyCashSummary;
  shifts?: {
    id: string;
    cashierName: string;
    cashierId: string;
    openedAt: number;
    closedAt?: number;
    status: string;
    openingFloat: number;
    cashSales: number;
    cashRefunds: number;
    repairCashIn: number;
    cashDrops: number;
    expectedCash: number;
    closingCountedCash?: number;
    variance?: number;
  }[];
  sales: Sale[];
  itemsBySaleId: Record<string, SaleItem[]>;
}

export interface MonthDailySummaryItem {
  day: number;
  dateKey: string;
  dayOfWeek: string;
  invoiceCount: number;
  netSales: number;
  hasSales: boolean;
}

export interface DayEndStatusData {
  dateKey: string;
  shopId: string;
  totalInvoices: number;
  completedInvoices: number;
  partiallyReturnedInvoices: number;
  fullyReturnedInvoices: number;
  cancelledInvoices: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  payments: {
    cash: number;
    card: number;
    bankTransfer: number;
    credit: number;
    paymentsReceivedOnAccount: number;
  };
  repairIncome: number;
  firstInvoiceNumber: string | null;
  lastInvoiceNumber: string | null;
  missingInvoices: string[];
  dailyCashSummary?: DailyCashSummary;
  sales: Sale[];
}

/**
 * Returns comprehensive daily sales figures, payments breakdown, and shifts for a specific date in Asia/Colombo.
 * Scoped to cashier's own sales if requestingUser is Cashier or Manager.
 */
export function getDailySalesData(
  shopId: string,
  dayTimestamp: number,
  requestingUser?: UserProfile
): DailySalesData {
  const store = loadLocalStore();
  const { startOfDay, endOfDay, dateKey } = getColomboDayRange(dayTimestamp);

  // Filter sales for the day and outlet
  let daySales = store.sales.filter(
    (s) => s.createdAt >= startOfDay && s.createdAt <= endOfDay
  );

  if (shopId && shopId !== "ALL") {
    daySales = daySales.filter((s) => s.shopId === shopId);
  }

  // Scoped to requesting user if not Super Admin
  if (requestingUser && requestingUser.role !== "SUPER_ADMIN") {
    daySales = daySales.filter((s) => s.cashierId === requestingUser.uid);
  }

  // Calculate totals
  let grossSales = 0;
  let itemDiscounts = 0;
  let billDiscounts = 0;
  let refunds = 0;
  let netSales = 0;
  const payments = { cash: 0, card: 0, bankTransfer: 0, credit: 0, paymentsReceivedOnAccount: 0 };
  const itemsBySaleId: Record<string, SaleItem[]> = {};

  daySales.forEach((sale) => {
    if (sale.status === "COMPLETED") {
      grossSales += sale.subtotal || 0;
      itemDiscounts += sale.discount || 0;
      refunds += sale.returnedAmount || 0;
      netSales += sale.total || 0;

      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach((p) => {
          if (p.method === "CASH") payments.cash += p.amount;
          else if (p.method === "CARD") payments.card += p.amount;
          else if (p.method === "BANK_TRANSFER") payments.bankTransfer += p.amount;
          else if (p.method === "CREDIT") payments.credit += p.amount;
        });
      }
    }

    itemsBySaleId[sale.id] = store.saleItems.filter((it) => it.saleId === sale.id);
  });

  // Calculate payments received on account today
  const dayCustomerPayments = (store.customerPayments || []).filter(
    (cp) =>
      cp.createdAt >= startOfDay &&
      cp.createdAt <= endOfDay &&
      (shopId === "ALL" || !shopId || cp.shopId === shopId) &&
      (!requestingUser || requestingUser.role === "SUPER_ADMIN" || cp.receivedBy === requestingUser.uid)
  );
  payments.paymentsReceivedOnAccount = dayCustomerPayments.reduce((sum, cp) => sum + cp.amount, 0);

  // Daily Cash Summary
  const dailyCashSummary = getDailyCashSummary({
    shopId,
    cashierId: requestingUser && requestingUser.role !== "SUPER_ADMIN" ? requestingUser.uid : undefined,
    timestamp: dayTimestamp,
  });

  // Repair income for the day
  let repairIncome = 0;
  store.repairs.forEach((r) => {
    const matchesShop = shopId === "ALL" || r.shopId === shopId;
    if (!matchesShop) return;
    if (r.receivedAt >= startOfDay && r.receivedAt <= endOfDay && r.advancePaid > 0) {
      repairIncome += r.advancePaid;
    }
    if (r.completedAt && r.completedAt >= startOfDay && r.completedAt <= endOfDay && r.balanceDue === 0) {
      const deliveredPaid = r.finalCost - r.advancePaid;
      if (deliveredPaid > 0) repairIncome += deliveredPaid;
    }
  });

  const parts = getColomboDateParts(dayTimestamp);
  const dateDisplay = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

  return {
    dateKey,
    dateDisplay,
    shopId,
    grossSales,
    itemDiscounts,
    billDiscounts,
    refunds,
    netSales,
    invoiceCount: daySales.filter((s) => s.status === "COMPLETED").length,
    payments,
    repairIncome,
    dailyCashSummary,
    shifts: [],
    sales: daySales,
    itemsBySaleId,
  };
}

/**
 * Returns month daily summaries for calendar/list view in Asia/Colombo.
 * Scoped by role if requestingUser is not Super Admin.
 */
export function getMonthDailySummary(
  shopId: string,
  year: number,
  month: number,
  requestingUser?: UserProfile
): MonthDailySummaryItem[] {
  const store = loadLocalStore();
  const { startOfMonth, endOfMonth, daysInMonth } = getColomboMonthRange(year, month);

  let monthSales = store.sales.filter(
    (s) => s.createdAt >= startOfMonth && s.createdAt <= endOfMonth
  );

  if (shopId && shopId !== "ALL") {
    monthSales = monthSales.filter((s) => s.shopId === shopId);
  }

  if (requestingUser && requestingUser.role !== "SUPER_ADMIN") {
    monthSales = monthSales.filter((s) => s.cashierId === requestingUser.uid);
  }

  // Bucketing by day of month (1 to daysInMonth)
  const summaries: MonthDailySummaryItem[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(Date.UTC(year, month - 1, d, 12, 0, 0));
    const dayOfWeek = dayNames[dateObj.getUTCDay()];

    summaries.push({
      day: d,
      dateKey,
      dayOfWeek,
      invoiceCount: 0,
      netSales: 0,
      hasSales: false,
    });
  }

  monthSales.forEach((sale) => {
    const parts = getColomboDateParts(sale.createdAt);
    if (parts.year === year && parts.month === month && parts.day >= 1 && parts.day <= daysInMonth) {
      const idx = parts.day - 1;
      summaries[idx].invoiceCount += 1;
      summaries[idx].netSales += sale.total || 0;
      summaries[idx].hasSales = true;
    }
  });

  return summaries;
}

/**
 * Returns Day-End Status data strictly for Super Admin.
 * Throws UNAUTHORIZED if called by other roles.
 */
export function getDayEndStatusData(
  shopId: string,
  dayTimestamp: number,
  requestingUser: UserProfile
): DayEndStatusData {
  if (!requestingUser || requestingUser.role !== "SUPER_ADMIN") {
    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
  }

  const store = loadLocalStore();
  const { startOfDay, endOfDay, dateKey } = getColomboDayRange(dayTimestamp);

  let daySales = store.sales.filter(
    (s) => s.createdAt >= startOfDay && s.createdAt <= endOfDay
  );

  if (shopId && shopId !== "ALL") {
    daySales = daySales.filter((s) => s.shopId === shopId);
  }

  let completedInvoices = 0;
  let partiallyReturnedInvoices = 0;
  let fullyReturnedInvoices = 0;
  let cancelledInvoices = 0;
  let grossSales = 0;
  let refunds = 0;
  let netSales = 0;
  const payments = { cash: 0, card: 0, bankTransfer: 0, credit: 0, paymentsReceivedOnAccount: 0 };

  daySales.forEach((sale) => {
    if (sale.status === "COMPLETED") {
      if (sale.returnStatus === "PARTIALLY_RETURNED") partiallyReturnedInvoices++;
      else if (sale.returnStatus === "FULLY_RETURNED") fullyReturnedInvoices++;
      else completedInvoices++;
    } else if (sale.status === "CANCELLED") {
      cancelledInvoices++;
    }

    grossSales += sale.subtotal || 0;
    refunds += sale.returnedAmount || 0;
    netSales += sale.total || 0;

    if (sale.payments && sale.payments.length > 0) {
      sale.payments.forEach((p) => {
        if (p.method === "CASH") payments.cash += p.amount;
        else if (p.method === "CARD") payments.card += p.amount;
        else if (p.method === "BANK_TRANSFER") payments.bankTransfer += p.amount;
        else if (p.method === "CREDIT") payments.credit += p.amount;
      });
    }
  });

  // Calculate payments received on account today
  const dayCustomerPayments = (store.customerPayments || []).filter(
    (cp) =>
      cp.createdAt >= startOfDay &&
      cp.createdAt <= endOfDay &&
      (shopId === "ALL" || !shopId || cp.shopId === shopId)
  );
  payments.paymentsReceivedOnAccount = dayCustomerPayments.reduce((sum, cp) => sum + cp.amount, 0);

  // Repair income for day
  let repairIncome = 0;
  store.repairs.forEach((r) => {
    const matchesShop = shopId === "ALL" || r.shopId === shopId;
    if (!matchesShop) return;
    if (r.receivedAt >= startOfDay && r.receivedAt <= endOfDay && r.advancePaid > 0) {
      repairIncome += r.advancePaid;
    }
    if (r.completedAt && r.completedAt >= startOfDay && r.completedAt <= endOfDay && r.balanceDue === 0) {
      const deliveredPaid = r.finalCost - r.advancePaid;
      if (deliveredPaid > 0) repairIncome += deliveredPaid;
    }
  });

  // Sequence integrity check
  const sortedSales = [...daySales].sort((a, b) =>
    a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true })
  );
  const firstInvoiceNumber = sortedSales.length > 0 ? sortedSales[0].invoiceNumber : null;
  const lastInvoiceNumber = sortedSales.length > 0 ? sortedSales[sortedSales.length - 1].invoiceNumber : null;

  const missingInvoices: string[] = [];
  const parsedSeq = sortedSales
    .map((s) => {
      const match = s.invoiceNumber.match(/(\d+)$/);
      return match
        ? {
            num: parseInt(match[1], 10),
            raw: s.invoiceNumber,
            prefix: s.invoiceNumber.slice(0, match.index),
            digits: match[1].length,
          }
        : null;
    })
    .filter(Boolean);

  if (parsedSeq.length > 1) {
    for (let i = 0; i < parsedSeq.length - 1; i++) {
      const curr = parsedSeq[i]!;
      const next = parsedSeq[i + 1]!;
      if (curr.prefix === next.prefix && next.num > curr.num + 1) {
        for (let gap = curr.num + 1; gap < next.num; gap++) {
          missingInvoices.push(`${curr.prefix}${String(gap).padStart(curr.digits, "0")}`);
        }
      }
    }
  }

  // Daily Cash Summary
  const dailyCashSummary = getDailyCashSummary({ shopId, timestamp: dayTimestamp });

  return {
    dateKey,
    shopId,
    totalInvoices: daySales.length,
    completedInvoices,
    partiallyReturnedInvoices,
    fullyReturnedInvoices,
    cancelledInvoices,
    grossSales,
    refunds,
    netSales,
    payments,
    repairIncome,
    firstInvoiceNumber,
    lastInvoiceNumber,
    missingInvoices,
    dailyCashSummary,
    sales: sortedSales,
  };
}
