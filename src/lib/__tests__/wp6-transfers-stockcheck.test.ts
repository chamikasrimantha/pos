// src/lib/__tests__/wp6-transfers-stockcheck.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  quickTransferStock,
  dispatchTransfer,
  receiveTransfer,
  getStockCheckRows,
  getCentralStockReport,
  getVariants,
  getInventoryForShop,
  getTransfers,
  getShops,
  resetLocalStoreForTesting,
  loadLocalStore,
  saveLocalStore,
} from "../firestore-service";
import { renderTransferNoteHTML } from "../receipt-generator";
import { UserProfile, Shop } from "@/types";

describe("WP6: Stock Check for Cashiers, Central Stock, and Quick Transfers", () => {
  beforeEach(() => {
    resetLocalStoreForTesting();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  const sampleCashier: UserProfile = {
    uid: "cashier_rw",
    email: "cashier.rw@shoes.pos",
    displayName: "Nadeeka Silva (RightWay Cashier)",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const sampleAdmin: UserProfile = {
    uid: "admin_user_01",
    email: "admin@shoes.pos",
    displayName: "Senaka Fernando (Super Admin)",
    role: "SUPER_ADMIN",
    allowedShopIds: ["ALL"],
    active: true,
  };

  const shops = getShops();
  const rightWayShop: Shop = shops.find((s) => s.id === "rightway") || shops[0];
  const megaShop: Shop = shops.find((s) => s.id === "mega") || shops[1];

  it("T1: Cashier scans three different products, sets quantities, transfers: source falls, destination rises, company total remains unchanged", async () => {
    const allVars = getVariants();
    const var1 = allVars[0];
    const var2 = allVars[1];
    const var3 = allVars[2];

    const rwInvBefore = getInventoryForShop("rightway");
    const megaInvBefore = getInventoryForShop("mega");

    const var1RwBefore = rwInvBefore.find((i) => i.variantId === var1.id)?.quantityOnHand || 0;
    const var1MegaBefore = megaInvBefore.find((i) => i.variantId === var1.id)?.quantityOnHand || 0;
    const var2RwBefore = rwInvBefore.find((i) => i.variantId === var2.id)?.quantityOnHand || 0;
    const var2MegaBefore = megaInvBefore.find((i) => i.variantId === var2.id)?.quantityOnHand || 0;
    const var3RwBefore = rwInvBefore.find((i) => i.variantId === var3.id)?.quantityOnHand || 0;
    const var3MegaBefore = megaInvBefore.find((i) => i.variantId === var3.id)?.quantityOnHand || 0;

    const totalBefore1 = var1RwBefore + var1MegaBefore;
    const totalBefore2 = var2RwBefore + var2MegaBefore;
    const totalBefore3 = var3RwBefore + var3MegaBefore;

    // Execute Quick Transfer of 3 products: qty 2, 1, 1
    const transfer = await quickTransferStock({
      fromShopId: "rightway",
      toShopId: "mega",
      items: [
        { variantId: var1.id, quantity: 2 },
        { variantId: var2.id, quantity: 1 },
        { variantId: var3.id, quantity: 1 },
      ],
      userId: sampleCashier.uid,
      userName: sampleCashier.displayName,
      notes: "Urgent customer rebalancing",
    });

    expect(transfer).toBeDefined();
    expect(transfer.status).toBe("RECEIVED");
    expect(transfer.mode).toBe("QUICK");
    expect(transfer.totalQuantity).toBe(4);
    expect(transfer.items).toHaveLength(3);
    expect(transfer.items[0].dispatchedQuantity).toBe(2);
    expect(transfer.items[0].receivedQuantity).toBe(2);

    const rwInvAfter = getInventoryForShop("rightway");
    const megaInvAfter = getInventoryForShop("mega");

    const var1RwAfter = rwInvAfter.find((i) => i.variantId === var1.id)?.quantityOnHand || 0;
    const var1MegaAfter = megaInvAfter.find((i) => i.variantId === var1.id)?.quantityOnHand || 0;
    const var2RwAfter = rwInvAfter.find((i) => i.variantId === var2.id)?.quantityOnHand || 0;
    const var2MegaAfter = megaInvAfter.find((i) => i.variantId === var2.id)?.quantityOnHand || 0;
    const var3RwAfter = rwInvAfter.find((i) => i.variantId === var3.id)?.quantityOnHand || 0;
    const var3MegaAfter = megaInvAfter.find((i) => i.variantId === var3.id)?.quantityOnHand || 0;

    // Check individual drops and increases
    expect(var1RwAfter).toBe(var1RwBefore - 2);
    expect(var1MegaAfter).toBe(var1MegaBefore + 2);
    expect(var2RwAfter).toBe(var2RwBefore - 1);
    expect(var2MegaAfter).toBe(var2MegaBefore + 1);
    expect(var3RwAfter).toBe(var3RwBefore - 1);
    expect(var3MegaAfter).toBe(var3MegaBefore + 1);

    // INVARIANCE: Total across RightWay + Mega must be strictly identical
    expect(var1RwAfter + var1MegaAfter).toBe(totalBefore1);
    expect(var2RwAfter + var2MegaAfter).toBe(totalBefore2);
    expect(var3RwAfter + var3MegaAfter).toBe(totalBefore3);

    // Central Stock total check
    const central = getCentralStockReport(sampleAdmin);
    const centralRow1 = central.rows.find((r) => r.variantId === var1.id)!;
    expect(centralRow1.totalStock).toBe(totalBefore1);
    expect(centralRow1.rightWayStock).toBe(var1RwAfter);
    expect(centralRow1.megaStock).toBe(var1MegaAfter);
  });

  it("T2: Quantity above source stock cannot be entered or submitted", async () => {
    const allVars = getVariants();
    const variant = allVars[0];
    const rwInv = getInventoryForShop("rightway");
    const onHand = rwInv.find((i) => i.variantId === variant.id)?.quantityOnHand || 0;

    // Attempting to transfer more than available stock must throw
    await expect(
      quickTransferStock({
        fromShopId: "rightway",
        toShopId: "mega",
        items: [{ variantId: variant.id, quantity: onHand + 99 }],
        userId: sampleCashier.uid,
        userName: sampleCashier.displayName,
      })
    ).rejects.toThrow(/insufficient stock/i);

    // Zero or negative quantity must throw
    await expect(
      quickTransferStock({
        fromShopId: "rightway",
        toShopId: "mega",
        items: [{ variantId: variant.id, quantity: 0 }],
        userId: sampleCashier.uid,
        userName: sampleCashier.displayName,
      })
    ).rejects.toThrow(/greater than zero/i);
  });

  it("T3: Submitting twice (double click) creates one transfer via idempotency key", async () => {
    const variant = getVariants()[0];
    const rwBefore = getInventoryForShop("rightway").find((i) => i.variantId === variant.id)!.quantityOnHand;
    const megaBefore = getInventoryForShop("mega").find((i) => i.variantId === variant.id)!.quantityOnHand;

    const idempotencyKey = `double_click_test_${Date.now()}`;

    // First submission
    const transfer1 = await quickTransferStock({
      fromShopId: "rightway",
      toShopId: "mega",
      items: [{ variantId: variant.id, quantity: 2 }],
      userId: sampleCashier.uid,
      userName: sampleCashier.displayName,
      idempotencyKey,
    });

    // Immediate second submission with identical key
    const transfer2 = await quickTransferStock({
      fromShopId: "rightway",
      toShopId: "mega",
      items: [{ variantId: variant.id, quantity: 2 }],
      userId: sampleCashier.uid,
      userName: sampleCashier.displayName,
      idempotencyKey,
    });

    expect(transfer1.id).toBe(transfer2.id);
    expect(transfer1.transferNumber).toBe(transfer2.transferNumber);

    // Stock must have been deducted only ONCE
    const rwAfter = getInventoryForShop("rightway").find((i) => i.variantId === variant.id)!.quantityOnHand;
    const megaAfter = getInventoryForShop("mega").find((i) => i.variantId === variant.id)!.quantityOnHand;

    expect(rwAfter).toBe(rwBefore - 2);
    expect(megaAfter).toBe(megaBefore + 2);

    // Transfers list must only contain one transfer for this key
    const transfers = getTransfers().filter((t) => t.idempotencyKey === idempotencyKey);
    expect(transfers).toHaveLength(1);
  });

  it("T4: Transfer of a variant that has no inventory record at destination creates it", async () => {
    const variant = getVariants()[0];

    // Ensure destination inventory does NOT exist for a new destination or reset record
    const store = loadLocalStore();
    const destKey = `mega_${variant.id}`;
    delete store.inventory[destKey];
    saveLocalStore(store);

    expect(getInventoryForShop("mega").find((i) => i.variantId === variant.id)).toBeUndefined();

    // Perform transfer to destination
    const transfer = await quickTransferStock({
      fromShopId: "rightway",
      toShopId: "mega",
      items: [{ variantId: variant.id, quantity: 3 }],
      userId: sampleAdmin.uid,
      userName: sampleAdmin.displayName,
    });

    expect(transfer.status).toBe("RECEIVED");

    // Destination inventory record MUST now exist and have 3 on hand
    const destInv = getInventoryForShop("mega").find((i) => i.variantId === variant.id);
    expect(destInv).toBeDefined();
    expect(destInv!.quantityOnHand).toBe(3);
    expect(destInv!.shopId).toBe("mega");
  });

  it("T5: Cashier can open Stock check, sees both branches' quantities, and sees no cost, value, movements or adjust action", () => {
    const stockCheckRows = getStockCheckRows("rightway", "mega");
    expect(stockCheckRows.length).toBeGreaterThan(0);

    const firstRow = stockCheckRows[0];
    expect(firstRow.productName).toBeDefined();
    expect(firstRow.thisBranchStock).toBeDefined();
    expect(firstRow.otherBranchStock).toBeDefined();
    expect(firstRow.totalStock).toBe(firstRow.thisBranchStock + firstRow.otherBranchStock);

    // Strict security check: Cost and Valuation fields must NOT exist on StockCheckRow
    expect((firstRow as any).referenceCostPrice).toBeUndefined();
    expect((firstRow as any).costValuation).toBeUndefined();
    expect((firstRow as any).retailValuation).toBeUndefined();

    // Super Admin Central Stock report throws when accessed by Cashier
    expect(() => getCentralStockReport(sampleCashier)).toThrow(/permission denied/i);
  });

  it("T6: Super Admin central stock total equals sum of both branches; report maths match", () => {
    const report = getCentralStockReport(sampleAdmin);
    expect(report.rows.length).toBeGreaterThan(0);

    let sumRightWay = 0;
    let sumMega = 0;
    let sumTotal = 0;
    let sumRetailVal = 0;
    let sumCostVal = 0;

    for (const r of report.rows) {
      // Row total must equal sum of branches
      expect(r.totalStock).toBe(r.rightWayStock + r.megaStock);
      expect(r.retailValuation).toBe(r.totalStock * r.sellingPrice);
      expect(r.costValuation).toBe(r.totalStock * r.referenceCostPrice);

      sumRightWay += r.rightWayStock;
      sumMega += r.megaStock;
      sumTotal += r.totalStock;
      sumRetailVal += r.retailValuation;
      sumCostVal += r.costValuation;
    }

    expect(report.rightWayUnits).toBe(sumRightWay);
    expect(report.megaUnits).toBe(sumMega);
    expect(report.totalUnits).toBe(sumTotal);
    expect(report.totalRetailValuation).toBe(sumRetailVal);
    expect(report.totalCostValuation).toBe(sumCostVal);
  });

  it("T7: Transfer note prints completed transfer format with sender and receiver", async () => {
    const variant = getVariants()[0];
    const transfer = await quickTransferStock({
      fromShopId: "rightway",
      toShopId: "mega",
      items: [{ variantId: variant.id, quantity: 1 }],
      userId: sampleCashier.uid,
      userName: sampleCashier.displayName,
      notes: "Express branch transfer",
    });

    const noteHTML = renderTransferNoteHTML(transfer, rightWayShop, megaShop);
    expect(noteHTML).toContain("COMPLETED STOCK TRANSFER NOTE");
    expect(noteHTML).toContain("COMPLETED TRANSFER (IMMEDIATE RECEIPT)");
    expect(noteHTML).toContain(rightWayShop.name);
    expect(noteHTML).toContain(megaShop.name);
    expect(noteHTML).toContain(transfer.transferNumber);
    expect(noteHTML).toContain("Express branch transfer");
    expect(noteHTML).toContain("Dispatched By (Origin)");
    expect(noteHTML).toContain("Received By (Destination)");
  });
});
