// src/lib/__tests__/wp11-migration-regression.test.ts
import { describe, it, expect } from "vitest";
import { runMigration } from "../../../scripts/migrate-cr02";

describe("WP11 - Data Migration & Stock Reconciliation (Section 8)", () => {
  it("migrates products, categories and sizes missing productType to FOOTWEAR", () => {
    const legacyStore = {
      categories: [{ id: "cat1", name: "Formal Shoes" }],
      sizes: [{ id: "sz1", sizeEu: 42, label: "42" }],
      products: [{ id: "prod1", name: "Classic Oxford", basePrice: 8500 }],
      variants: [{ id: "var1", productId: "prod1", barcode: "2012345678901" }],
    };

    const { updatedData, report } = runMigration(legacyStore, false);

    expect(report.categoriesUpdated).toBe(1);
    expect(report.sizesUpdated).toBe(1);
    expect(report.productsUpdated).toBe(1);
    expect(updatedData.categories[0].productType).toBe("FOOTWEAR");
    expect(updatedData.sizes[0].productType).toBe("FOOTWEAR");
    expect(updatedData.products[0].productType).toBe("FOOTWEAR");
    expect(updatedData.variants[0].productType).toBe("FOOTWEAR");
  });

  it("migrates sales to PAID, amountPaid=total, balanceDue=0 while preserving cancelled sales", () => {
    const legacyStore = {
      sales: [
        { id: "sale1", total: 12000, status: "COMPLETED" },
        { id: "sale2", total: 8000, status: "CANCELLED" },
      ],
      saleItems: [
        { id: "item1", saleId: "sale1", unitSellingPrice: 6000 },
        { id: "item2", saleId: "sale1", unitSellingPrice: 6000 },
      ],
    };

    const { updatedData, report } = runMigration(legacyStore, false);

    expect(report.salesUpdated).toBe(2);
    expect(report.saleItemsUpdated).toBe(2);

    expect(updatedData.sales[0].paymentStatus).toBe("PAID");
    expect(updatedData.sales[0].amountPaid).toBe(12000);
    expect(updatedData.sales[0].balanceDue).toBe(0);

    expect(updatedData.sales[1].status).toBe("CANCELLED");
    expect(updatedData.sales[1].paymentStatus).toBe("PAID");
    expect(updatedData.sales[1].amountPaid).toBe(8000);
    expect(updatedData.sales[1].balanceDue).toBe(0);

    expect(updatedData.saleItems[0].listPrice).toBe(6000);
    expect(updatedData.saleItems[0].priceOverridden).toBe(false);
  });

  it("migrates purchases to CREDIT, computes paymentStatus from balance, sets reviewStatus=OK", () => {
    const legacyStore = {
      purchases: [
        { id: "pur1", totalAmount: 50000, paidAmount: 50000, balanceDue: 0 },
        { id: "pur2", totalAmount: 30000, paidAmount: 10000, balanceDue: 20000 },
        { id: "pur3", totalAmount: 25000, paidAmount: 0, balanceDue: 25000 },
      ],
    };

    const { updatedData, report } = runMigration(legacyStore, false);

    expect(report.purchasesUpdated).toBe(3);

    expect(updatedData.purchases[0].paymentMethod).toBe("CREDIT");
    expect(updatedData.purchases[0].paymentStatus).toBe("PAID");
    expect(updatedData.purchases[0].reviewStatus).toBe("OK");

    expect(updatedData.purchases[1].paymentMethod).toBe("CREDIT");
    expect(updatedData.purchases[1].paymentStatus).toBe("PARTIALLY_PAID");
    expect(updatedData.purchases[1].reviewStatus).toBe("OK");

    expect(updatedData.purchases[2].paymentMethod).toBe("CREDIT");
    expect(updatedData.purchases[2].paymentStatus).toBe("UNPAID");
    expect(updatedData.purchases[2].reviewStatus).toBe("OK");
  });

  it("migrates transfers to FORMAL mode and repairs to FOOTWEAR preserving shiftId", () => {
    const legacyStore = {
      transfers: [
        { id: "trf1", transferNumber: "TRF-001", status: "RECEIVED" },
      ],
      repairs: [
        {
          id: "rep1",
          repairNumber: "REP-001",
          shiftId: "shift_legacy_123",
          shoeBrand: "Bata",
        },
      ],
    };

    const { updatedData, report } = runMigration(legacyStore, false);

    expect(report.transfersUpdated).toBe(1);
    expect(updatedData.transfers[0].mode).toBe("FORMAL");

    expect(report.repairsUpdated).toBe(1);
    expect(updatedData.repairs[0].itemType).toBe("FOOTWEAR");
    expect(updatedData.repairs[0].estimateProvided).toBe(true);
    expect(updatedData.repairs[0].underWarranty).toBe(false);
    expect(updatedData.repairs[0].shiftId).toBe("shift_legacy_123");
  });

  it("handles manager user removal: deletes unreferenced, marks referenced as inactive and hidden", () => {
    const legacyStore = {
      users: [
        { uid: "mgr_unref", role: "SHOP_MANAGER", active: true, hidden: false },
        { uid: "mgr_ref", role: "SHOP_MANAGER", active: true, hidden: false },
        { uid: "admin1", role: "SUPER_ADMIN", active: true, hidden: false },
      ],
      sales: [
        { id: "s1", cashierId: "mgr_ref", total: 5000 },
      ],
    };

    const { updatedData, report } = runMigration(legacyStore, false);

    expect(report.usersHardDeleted).toBe(1);
    expect(report.usersSoftDeleted).toBe(1);

    expect(updatedData.users.find((u: any) => u.uid === "mgr_unref")).toBeUndefined();
    const refMgr = updatedData.users.find((u: any) => u.uid === "mgr_ref");
    expect(refMgr).toBeDefined();
    expect(refMgr.active).toBe(false);
    expect(refMgr.hidden).toBe(true);
  });

  it("leaves shifts untouched and reconciles stock against movement ledger", () => {
    const legacyStore = {
      shifts: [
        { id: "shift_1", status: "CLOSED", openingCash: 5000 },
        { id: "shift_2", status: "CLOSED", openingCash: 5000 },
      ],
      inventory: {
        "rightway_v1": {
          id: "rightway_v1",
          shopId: "rightway",
          variantId: "v1",
          productId: "p1",
          quantityOnHand: 15,
        },
        "rightway_v2": {
          id: "rightway_v2",
          shopId: "rightway",
          variantId: "v2",
          productId: "p2",
          quantityOnHand: 10,
        },
      },
      movements: [
        {
          id: "m1",
          shopId: "rightway",
          variantId: "v1",
          type: "SALE_OUT",
          quantity: 2,
          direction: "OUT",
          quantityBefore: 17,
          quantityAfter: 15,
          createdAt: 1000,
        },
        {
          id: "m2",
          shopId: "rightway",
          variantId: "v2",
          type: "SALE_OUT",
          quantity: 3,
          direction: "OUT",
          quantityBefore: 10,
          quantityAfter: 7, // discrepancy: ledger says 7, inventory says 10
          createdAt: 1000,
        },
      ],
    };

    const { report } = runMigration(legacyStore, false);

    expect(report.shiftsUntouched).toBe(2);
    expect(report.stockReconciliation.totalChecked).toBe(2);
    expect(report.stockReconciliation.matched).toBe(1);
    expect(report.stockReconciliation.mismatches.length).toBe(1);
    expect(report.stockReconciliation.mismatches[0].variantId).toBe("v2");
    expect(report.stockReconciliation.mismatches[0].quantityOnHand).toBe(10);
    expect(report.stockReconciliation.mismatches[0].movementNetSum).toBe(7);
  });

  it("dry-run mode does not mutate original data", () => {
    const legacyStore = {
      categories: [{ id: "cat1", name: "Formal Shoes" }],
    };

    const { updatedData, report } = runMigration(legacyStore, true);

    expect(report.dryRun).toBe(true);
    expect(report.categoriesUpdated).toBe(1);
    expect(legacyStore.categories[0] as any).not.toHaveProperty("productType");
    expect(updatedData.categories[0].productType).toBe("FOOTWEAR");
  });
});

