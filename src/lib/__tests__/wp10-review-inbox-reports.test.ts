// src/lib/__tests__/wp10-review-inbox-reports.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocalStore,
  saveLocalStore,
  createQuickProduct,
  createSupplier,
  createPurchase,
  completeSale,
  createRepairOrder,
  getReviewInboxCounts,
  getReviewInboxItems,
  markReviewInboxItem,
  getDailySalesData,
  getDayEndStatusData,
} from "../firestore-service";
import { hasPermission, isModuleVisible } from "../permissions";
import { UserProfile, PriceOverrideItem } from "@/types";

describe("WP10: Review Inbox and Reports (V1 - V4)", () => {
  const superAdmin: UserProfile = {
    uid: "admin_user_001",
    email: "admin@apex.lk",
    displayName: "Super Administrator",
    role: "SUPER_ADMIN",
    active: true,
    allowedShopIds: ["rightway", "mega"],
  };

  const cashier: UserProfile = {
    uid: "cashier_user_001",
    email: "cashier@rightway.lk",
    displayName: "Kamal Perera",
    role: "CASHIER",
    active: true,
    allowedShopIds: ["rightway"],
  };

  beforeEach(() => {
    const store = loadLocalStore();
    // Ensure clean test collections
    store.products = [];
    store.variants = [];
    store.inventory = {};
    store.suppliers = [];
    store.purchases = [];
    store.cheques = [];
    store.sales = [];
    store.saleItems = [];
    store.transfers = [];
    store.repairs = [];
    store.customers = [];
    store.customerPayments = [];
    store.customerLedger = [];
    store.users = [superAdmin, cashier];
    saveLocalStore(store);
  });

  // ── V1 ─────────────────────────────────────────────────────────────────────
  it("V1: A cashier's new product, supplier, purchase and cheque each appear in the right tab and clear after Mark reviewed", async () => {
    // 1. Cashier creates a new product via quick add
    const prodResult = await createQuickProduct({
      name: "Swift Canvas Runner",
      productType: "FOOTWEAR",
      brandId: "brand_apex",
      categoryId: "cat_sneakers",
      colorId: "col_blk",
      sizeId: "size_42",
      sellingPrice: 4500,
      startingQuantity: 5,
      shopId: "rightway",
      createdBy: cashier.uid,
    });

    // 2. Cashier creates a new supplier
    const supResult = await createSupplier({
      name: "Lanka Leather Works",
      phone: "0771234567",
      contactPerson: "Nimal",
      callingUser: cashier,
    });

    // 3. Cashier creates a purchase bill
    const purResult = await createPurchase({
      shopId: "rightway",
      supplierId: supResult.id,
      paymentMethod: "CASH",
      items: [
        {
          variant: prodResult.variant,
          quantity: 10,
          unitCost: 2000,
        },
      ],
      callingUser: cashier,
    });

    // 4. Cashier creates a purchase paid via cheque
    const chqPurchaseResult = await createPurchase({
      shopId: "rightway",
      supplierId: supResult.id,
      paymentMethod: "CHEQUE",
      chequeDetails: {
        chequeNumber: "CHQ-889900",
        bankName: "Commercial Bank",
        chequeDate: Date.now() + 86400000 * 30,
      },
      items: [
        {
          variant: prodResult.variant,
          quantity: 5,
          unitCost: 3000,
        },
      ],
      callingUser: cashier,
    });
    const chqResult = chqPurchaseResult.cheque!;

    // Check counts
    const initialCounts = getReviewInboxCounts(superAdmin);
    expect(initialCounts.products).toBeGreaterThanOrEqual(1);
    expect(initialCounts.suppliers).toBeGreaterThanOrEqual(1);
    expect(initialCounts.purchases).toBeGreaterThanOrEqual(1);
    expect(initialCounts.cheques).toBeGreaterThanOrEqual(1);

    // Verify each item appears in its tab
    const productItems = getReviewInboxItems(superAdmin, "products");
    expect(productItems.some((p) => p.id === prodResult.product.id)).toBe(true);

    const supplierItems = getReviewInboxItems(superAdmin, "suppliers");
    expect(supplierItems.some((s) => s.id === supResult.id)).toBe(true);

    const purchaseItems = getReviewInboxItems(superAdmin, "purchases");
    expect(purchaseItems.some((p) => p.id === purResult.purchase.id)).toBe(true);

    const chequeItems = getReviewInboxItems(superAdmin, "cheques");
    expect(chequeItems.some((c) => c.id === chqResult.id)).toBe(true);

    // Super Admin marks each item reviewed
    markReviewInboxItem({
      category: "products",
      itemId: prodResult.product.id,
      note: "Product approved",
      callingUser: superAdmin,
    });
    markReviewInboxItem({
      category: "suppliers",
      itemId: supResult.id,
      note: "Supplier verified",
      callingUser: superAdmin,
    });
    markReviewInboxItem({
      category: "purchases",
      itemId: purResult.purchase.id,
      note: "Purchase verified",
      callingUser: superAdmin,
    });
    markReviewInboxItem({
      category: "cheques",
      itemId: chqResult.id,
      note: "Cheque confirmed",
      callingUser: superAdmin,
    });

    // Verify all cleared from the review inbox
    const updatedProductItems = getReviewInboxItems(superAdmin, "products");
    expect(updatedProductItems.some((p) => p.id === prodResult.product.id)).toBe(false);

    const updatedSupplierItems = getReviewInboxItems(superAdmin, "suppliers");
    expect(updatedSupplierItems.some((s) => s.id === supResult.id)).toBe(false);

    const updatedPurchaseItems = getReviewInboxItems(superAdmin, "purchases");
    expect(updatedPurchaseItems.some((p) => p.id === purResult.purchase.id)).toBe(false);

    const updatedChequeItems = getReviewInboxItems(superAdmin, "cheques");
    expect(updatedChequeItems.some((c) => c.id === chqResult.id)).toBe(false);
  });

  // ── V2 ─────────────────────────────────────────────────────────────────────
  it("V2: A price override appears in the Price overrides tab with product, list price, price charged and cashier", async () => {
    // 1. Create a product with stock
    const prodResult = await createQuickProduct({
      name: "Apex Air Walk",
      productType: "FOOTWEAR",
      brandId: "brand_apex",
      categoryId: "cat_shoes",
      colorId: "col_blk",
      sizeId: "size_42",
      sellingPrice: 5000,
      startingQuantity: 10,
      shopId: "rightway",
      createdBy: cashier.uid,
    });

    // 2. Complete sale with price override: list price 5000, charged 4000 (20% off)
    const saleResult = await completeSale({
      shopId: "rightway",
      cashierId: cashier.uid,
      cashierName: cashier.displayName,
      items: [
        {
          variant: prodResult.variant,
          quantity: 1,
          unitPrice: 4000,
          listPrice: 5000,
          priceOverridden: true,
          priceOverrideReason: "Clearance discount for loyal customer",
          discount: 1000,
          lineTotal: 4000,
        },
      ],
      subtotal: 5000,
      discount: 1000,
      taxAmount: 0,
      total: 4000,
      payments: [{ method: "CASH", amount: 4000 }],
    });

    // 3. Query price overrides tab
    const overrideItems = getReviewInboxItems(superAdmin, "priceOverrides") as any[];
    expect(overrideItems.length).toBeGreaterThanOrEqual(1);

    const item = overrideItems.find((o) => o.saleId === saleResult.sale.id);
    expect(item).toBeDefined();
    expect(item!.listPrice).toBe(5000);
    expect(item!.priceCharged).toBe(4000);
    expect(item!.reduction).toBe(1000);
    expect(item!.reductionPercent).toBeCloseTo(20, 1);
    expect(item!.cashierName).toBe(cashier.displayName);
    expect(item!.reason).toBe("Clearance discount for loyal customer");

    // 4. Test reduction filter
    const highReductionItems = getReviewInboxItems(superAdmin, "priceOverrides", { minDiscountPercent: 25 }) as any[];
    expect(highReductionItems.some((o) => o.saleId === saleResult.sale.id)).toBe(false);

    const matchingReductionItems = getReviewInboxItems(superAdmin, "priceOverrides", { minDiscountPercent: 15 }) as any[];
    expect(matchingReductionItems.some((o) => o.saleId === saleResult.sale.id)).toBe(true);

    // 5. Mark reviewed
    markReviewInboxItem({
      category: "priceOverrides",
      itemId: item!.id,
      note: "Discount approved by admin",
      callingUser: superAdmin,
    });

    const clearedOverrides = getReviewInboxItems(superAdmin, "priceOverrides") as any[];
    expect(clearedOverrides.some((o) => o.id === item!.id)).toBe(false);
  });

  // ── V3 ─────────────────────────────────────────────────────────────────────
  it("V3: A cashier cannot see or access the Review Inbox (UI and data layer)", () => {
    // 1. Data layer guards throw PERMISSION_DENIED for cashiers
    expect(() => getReviewInboxCounts(cashier)).toThrow("You do not have permission to do this.");
    expect(() => getReviewInboxItems(cashier, "products")).toThrow("You do not have permission to do this.");
    expect(() =>
      markReviewInboxItem({
        category: "products",
        itemId: "p1",
        callingUser: cashier,
      })
    ).toThrow("You do not have permission to do this.");

    // 2. Permissions matrix checks
    expect(hasPermission("CASHIER", "review_inbox.view")).toBe(false);
    expect(hasPermission("SHOP_MANAGER", "review_inbox.view")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "review_inbox.view")).toBe(true);

    // 3. Module visibility access
    expect(isModuleVisible("CASHIER", "reviewInbox")).toBe(false);
    expect(isModuleVisible("SHOP_MANAGER", "reviewInbox")).toBe(false);
    expect(isModuleVisible("SUPER_ADMIN", "reviewInbox")).toBe(true);
  });

  // ── V4 ─────────────────────────────────────────────────────────────────────
  it("V4: Report totals equal the sums of the underlying records for a seeded day", async () => {
    const today = Date.now();

    // 1. Create product
    const prodResult = await createQuickProduct({
      name: "Apex Velocity Boot",
      productType: "FOOTWEAR",
      brandId: "brand_apex",
      categoryId: "cat_boots",
      colorId: "col_brn",
      sizeId: "size_42",
      sellingPrice: 6000,
      startingQuantity: 20,
      shopId: "rightway",
      createdBy: cashier.uid,
    });

    // 2. Sale 1: Fully paid via CASH (6,000)
    await completeSale({
      shopId: "rightway",
      cashierId: cashier.uid,
      cashierName: cashier.displayName,
      items: [
        {
          variant: prodResult.variant,
          quantity: 1,
          unitPrice: 6000,
          listPrice: 6000,
          discount: 0,
          lineTotal: 6000,
        },
      ],
      subtotal: 6000,
      discount: 0,
      taxAmount: 0,
      total: 6000,
      payments: [{ method: "CASH", amount: 6000 }],
    });

    // 3. Sale 2: Fully paid via CARD (6,000)
    await completeSale({
      shopId: "rightway",
      cashierId: cashier.uid,
      cashierName: cashier.displayName,
      items: [
        {
          variant: prodResult.variant,
          quantity: 1,
          unitPrice: 6000,
          listPrice: 6000,
          discount: 0,
          lineTotal: 6000,
        },
      ],
      subtotal: 6000,
      discount: 0,
      taxAmount: 0,
      total: 6000,
      payments: [{ method: "CARD", amount: 6000 }],
    });

    // 4. Sale 3: Credit sale with part payment (Total 6,000; Paid 2,000 via CASH; Balance 4,000 via CREDIT)
    const store = loadLocalStore();
    const custId = "cust_seeded_001";
    store.customers.push({
      id: custId,
      name: "Sunil Silva",
      phone: "0711122334",
      type: "REGULAR",
      creditLimit: 20000,
      active: true,
      createdBy: cashier.uid,
      createdAt: today,
    });
    saveLocalStore(store);

    await completeSale({
      shopId: "rightway",
      cashierId: cashier.uid,
      cashierName: cashier.displayName,
      customerId: custId,
      customerName: "Sunil Silva",
      customerPhone: "0711122334",
      items: [
        {
          variant: prodResult.variant,
          quantity: 1,
          unitPrice: 6000,
          listPrice: 6000,
          discount: 0,
          lineTotal: 6000,
        },
      ],
      subtotal: 6000,
      discount: 0,
      taxAmount: 0,
      total: 6000,
      payments: [
        { method: "CASH", amount: 2000 },
        { method: "CREDIT", amount: 4000 },
      ],
    });

    // 5. Seed a cash purchase bill (amount 5,000)
    const sup = await createSupplier({
      name: "Seeded Leather Co",
      phone: "0778899112",
      callingUser: superAdmin,
    });

    await createPurchase({
      shopId: "rightway",
      supplierId: sup.id,
      paymentMethod: "CASH",
      items: [
        {
          variant: prodResult.variant,
          quantity: 2,
          unitCost: 2500,
        },
      ],
      callingUser: cashier,
    });

    // 6. Seed a customer payment received on account (2,000 cash)
    const storeWithCust = loadLocalStore();
    storeWithCust.customerPayments.push({
      id: "cp_test_001",
      paymentNumber: "RW-PAY-000001",
      customerId: custId,
      customerName: "Sunil Silva",
      amount: 2000,
      method: "CASH",
      shopId: "rightway",
      receivedBy: cashier.uid,
      receivedByName: cashier.displayName,
      createdAt: today,
      settledInvoices: [],
    });
    saveLocalStore(storeWithCust);

    // 7. Verify Daily Sales Report Calculations
    const dailyData = getDailySalesData("rightway", today, superAdmin);

    // Gross sales = 6000 + 6000 + 6000 = 18000
    expect(dailyData.grossSales).toBe(18000);
    // Net sales = 18000
    expect(dailyData.netSales).toBe(18000);
    // Invoice count = 3
    expect(dailyData.invoiceCount).toBe(3);
    // Tenders:
    // Cash = 6000 (sale 1) + 2000 (sale 3 part) = 8000
    expect(dailyData.payments.cash).toBe(8000);
    // Card = 6000 (sale 2)
    expect(dailyData.payments.card).toBe(6000);
    // Credit = 4000 (sale 3 credit)
    expect(dailyData.payments.credit).toBe(4000);
    // Payments received on account = 2000
    expect(dailyData.payments.paymentsReceivedOnAccount).toBe(2000);
    // Cash purchases = 5000
    expect(dailyData.totalPurchasesCash).toBe(5000);
    expect(dailyData.purchasesPaidInCash?.length).toBe(1);

    // 8. Verify Day-End Status Calculations
    const dayEndData = getDayEndStatusData("rightway", today, superAdmin);

    expect(dayEndData.totalInvoices).toBe(3);
    expect(dayEndData.completedInvoices).toBe(3);
    // Payment settlement breakdown:
    // Sale 1 & 2 are PAID = 2
    expect(dayEndData.paidInvoicesCount).toBe(2);
    // Sale 3 is PARTIALLY_PAID = 1
    expect(dayEndData.partiallyPaidInvoicesCount).toBe(1);
    expect(dayEndData.creditInvoicesCount).toBe(0);
    // Credit totals:
    // Total credit sales amount = 6000 (sale 3)
    expect(dayEndData.totalCreditSalesAmount).toBe(6000);
    // Collected now = 2000
    expect(dayEndData.totalCreditCollectedNow).toBe(2000);
    // Balance due = 4000
    expect(dayEndData.totalCreditBalanceDue).toBe(4000);
  });
});
