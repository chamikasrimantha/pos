// src/lib/__tests__/wp4-manual-price.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  completeSale,
  processCustomerReturn,
  updateSystemSettings,
  getVariants,
  createQuickProduct,
  resetLocalStoreForTesting,
} from "../firestore-service";
import { ProductVariant, PaymentEntry, ReturnItem, UserProfile } from "@/types";

describe("WP4: POS Manual Price, Price Per Unit, and Scan Popup", () => {
  beforeEach(() => {
    resetLocalStoreForTesting();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  const sampleCashier: UserProfile = {
    uid: "cashier_rw_01",
    email: "cashier@pos.lk",
    displayName: "Kamal Perera",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  it("X1: Scan a product, press Enter: one pair is added at the catalogue price", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_41")!;
    expect(variant).toBeDefined();

    const result = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          listPrice: variant.sellingPrice,
          priceOverridden: false,
          discount: 0,
          lineTotal: variant.sellingPrice,
        },
      ],
      subtotal: variant.sellingPrice,
      discount: 0,
      taxAmount: 0,
      total: variant.sellingPrice,
      payments: [{ method: "CASH", amount: variant.sellingPrice }],
    });

    expect(result.sale).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].unitSellingPrice).toBe(variant.sellingPrice);
    expect(result.items[0].priceOverridden).toBe(false);
  });

  it("X2: Scan, type 17,500, press Enter: the line shows 17,500 and is marked overridden in the saved sale", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_41")!;
    const cataloguePrice = variant.sellingPrice; // 18900
    const overriddenPrice = 17500;

    const result = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: overriddenPrice,
          listPrice: cataloguePrice,
          priceOverridden: true,
          priceOverrideReason: "Customer negotiated discount",
          discount: 0,
          lineTotal: overriddenPrice,
        },
      ],
      subtotal: overriddenPrice,
      discount: 0,
      taxAmount: 0,
      total: overriddenPrice,
      payments: [{ method: "CASH", amount: overriddenPrice }],
    });

    expect(result.items[0].unitSellingPrice).toBe(17500);
    expect(result.items[0].listPrice).toBe(cataloguePrice);
    expect(result.items[0].priceOverridden).toBe(true);
    expect(result.items[0].priceOverrideReason).toBe("Customer negotiated discount");
  });

  it("X3: Quantity 3: set pair prices 18,900, 18,000 and 17,500: the cart shows three lines and the total is the sum", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_42")!;
    const cataloguePrice = variant.sellingPrice;

    const p1 = 18900;
    const p2 = 18000;
    const p3 = 17500;
    const totalExpected = p1 + p2 + p3;

    const result = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        { variant, quantity: 1, unitPrice: p1, listPrice: cataloguePrice, discount: 0, lineTotal: p1 },
        { variant, quantity: 1, unitPrice: p2, listPrice: cataloguePrice, discount: 0, lineTotal: p2 },
        { variant, quantity: 1, unitPrice: p3, listPrice: cataloguePrice, discount: 0, lineTotal: p3 },
      ],
      subtotal: totalExpected,
      discount: 0,
      taxAmount: 0,
      total: totalExpected,
      payments: [{ method: "CASH", amount: totalExpected }],
    });

    expect(result.items).toHaveLength(3);
    expect(result.sale.total).toBe(54400);
  });

  it("X4: Two pairs with 'same price' 18,000 merge into one line with quantity 2", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_42")!;

    const result = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant,
          quantity: 2,
          unitPrice: 18000,
          listPrice: variant.sellingPrice,
          priceOverridden: true,
          discount: 0,
          lineTotal: 36000,
        },
      ],
      subtotal: 36000,
      discount: 0,
      taxAmount: 0,
      total: 36000,
      payments: [{ method: "CASH", amount: 36000 }],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].unitSellingPrice).toBe(18000);
    expect(result.items[0].lineTotal).toBe(36000);
  });

  it("X6: An unknown barcode is added via Quick Add and reaches the cart at entered price", async () => {
    const newBarcode = "8909999001112";
    const created = await createQuickProduct({
      productType: "FOOTWEAR",
      name: "Apex Handcrafted Derby",
      categoryId: "cat_formal_men",
      brandId: "br_clarks",
      colorId: "col_black",
      sizeId: "sz_42",
      sellingPrice: 15500,
      startingQuantity: 3,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
      barcode: newBarcode,
    });

    expect(created.variant.barcode).toBe(newBarcode);
    expect(created.variant.sellingPrice).toBe(15500);

    const sale = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant: created.variant,
          quantity: 1,
          unitPrice: 15500,
          listPrice: 15500,
          discount: 0,
          lineTotal: 15500,
        },
      ],
      subtotal: 15500,
      discount: 0,
      taxAmount: 0,
      total: 15500,
      payments: [{ method: "CASH", amount: 15500 }],
    });

    expect(sale.items[0].unitSellingPrice).toBe(15500);
  });

  it("X7: With the floor set to 90% of list, a cashier entering 80% is refused; with no floor it is accepted", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_41")!; // sellingPrice 18900
    const listPrice = variant.sellingPrice;
    const eightyPercentPrice = Math.round(listPrice * 0.8); // 15120

    // 1. Set floor to 90% of list
    await updateSystemSettings(
      {
        priceFloorMode: "PERCENT_OF_LIST",
        priceFloorValue: 90,
      },
      "admin_01"
    );

    // Cashier entering 80% must be rejected
    await expect(
      completeSale({
        shopId: "rightway",
        cashierId: sampleCashier.uid,
        cashierName: sampleCashier.displayName,
        items: [
          {
            variant,
            quantity: 1,
            unitPrice: eightyPercentPrice,
            listPrice,
            priceOverridden: true,
            discount: 0,
            lineTotal: eightyPercentPrice,
          },
        ],
        subtotal: eightyPercentPrice,
        discount: 0,
        taxAmount: 0,
        total: eightyPercentPrice,
        payments: [{ method: "CASH", amount: eightyPercentPrice }],
      })
    ).rejects.toThrow("This price is too low.");

    // 2. Remove floor (priceFloorMode: "NONE")
    await updateSystemSettings(
      {
        priceFloorMode: "NONE",
        priceFloorValue: 0,
      },
      "admin_01"
    );

    // Now 80% is accepted
    const successResult = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: eightyPercentPrice,
          listPrice,
          priceOverridden: true,
          discount: 0,
          lineTotal: eightyPercentPrice,
        },
      ],
      subtotal: eightyPercentPrice,
      discount: 0,
      taxAmount: 0,
      total: eightyPercentPrice,
      payments: [{ method: "CASH", amount: eightyPercentPrice }],
    });

    expect(successResult.items[0].unitSellingPrice).toBe(eightyPercentPrice);
    expect(successResult.items[0].priceOverridden).toBe(true);
  });

  it("X8: A return of a line sold at an overridden price refunds that overridden price", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_41")!;
    const overriddenPrice = 17500;

    const original = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: overriddenPrice,
          listPrice: variant.sellingPrice,
          priceOverridden: true,
          discount: 0,
          lineTotal: overriddenPrice,
        },
      ],
      subtotal: overriddenPrice,
      discount: 0,
      taxAmount: 0,
      total: overriddenPrice,
      payments: [{ method: "CASH", amount: overriddenPrice }],
    });

    const returnItem: ReturnItem = {
      variantId: variant.id,
      quantity: 1,
      unitPriceRefunded: original.items[0].unitSellingPrice, // 17500
      condition: "NEW_RESELLABLE",
      restocked: true,
      reason: "SIZE_FIT",
      variantDescriptionCache: original.items[0].variantDescriptionCache,
    };

    const customerReturn = await processCustomerReturn({
      shopId: "rightway",
      originalSale: original.sale,
      items: [returnItem],
      refundMethod: "CASH",
      cashierId: sampleCashier.uid,
    });

    expect(customerReturn.netRefundAmount).toBe(17500);
    expect(customerReturn.subtotalRefund).toBe(17500);
    expect(customerReturn.items[0].unitPriceRefunded).toBe(17500);
  });
});
