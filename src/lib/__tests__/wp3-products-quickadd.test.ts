// src/lib/__tests__/wp3-products-quickadd.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEan13Barcode,
  createQuickProduct,
  updateProductMaster,
  getCategories,
  getBrands,
  getSizes,
  getProducts,
  getVariants,
} from "../firestore-service";
import { isValidEan13 } from "../barcode-svg";
import {
  renderSingleThermalBarcodeLabel,
  renderThermalBarcodeLabelHTML,
} from "../receipt-generator";
import { can } from "../permissions";
import { UserProfile, ProductType } from "@/types";
import { SEED_CATEGORIES } from "../seed-data";

describe("WP3: Products, Catalogue, Editing, Quick Add, Label Editor", () => {
  beforeEach(() => {
    // Clear localStorage mock if applicable
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("P1 & P9: Category list includes Slippers & Sandals and Bag categories, filters by ProductType", () => {
    const footwearCats = getCategories("FOOTWEAR");
    const bagCats = getCategories("BAG");

    // Footwear contains Slippers & Sandals
    const slippers = footwearCats.find((c) => c.id === "cat_slippers_sandals");
    expect(slippers).toBeDefined();
    expect(slippers?.name).toBe("Slippers & Sandals");

    // Bag categories
    expect(bagCats.some((c) => c.id === "cat_bag_luggage")).toBe(true);
    expect(bagCats.some((c) => c.id === "cat_bag_school")).toBe(true);
    expect(bagCats.some((c) => c.id === "cat_bag_travel")).toBe(true);
    expect(bagCats.some((c) => c.id === "cat_bag_pouches")).toBe(true);
    expect(bagCats.some((c) => c.id === "cat_bag_handbags")).toBe(true);
    expect(bagCats.some((c) => c.id === "cat_bag_backpacks")).toBe(true);
  });

  it("P2: Sizes filter by ProductType (Shoe sizes vs Bag sizes)", () => {
    const footwearSizes = getSizes("FOOTWEAR");
    const bagSizes = getSizes("BAG");

    expect(footwearSizes.some((s) => s.label.includes("EU 41"))).toBe(true);
    expect(bagSizes.some((s) => s.label.includes("20\" Cabin"))).toBe(true);
    expect(bagSizes.some((s) => s.label.includes("Small (S)"))).toBe(true);
    // Footwear should not contain bag sizes
    expect(footwearSizes.some((s) => s.label.includes("20\" Cabin"))).toBe(false);
  });

  it("P5: Barcode auto-generation produces a unique 13-digit EAN that satisfies Modulo-10 checksum", () => {
    for (let i = 0; i < 20; i++) {
      const ean = generateEan13Barcode();
      expect(ean).toHaveLength(13);
      expect(/^\d{13}$/.test(ean)).toBe(true);
      expect(isValidEan13(ean)).toBe(true);
    }
  });

  it("P3 & P4: Cashier quick-add creates product and variant flagged as NEEDS_REVIEW", async () => {
    const created = await createQuickProduct({
      productType: "BAG",
      name: "Wildcraft Compact Sling",
      categoryId: "cat_bag_pouches",
      brandId: "br_wildcraft",
      colorId: "col_black",
      sizeId: "sz_bag_s",
      sellingPrice: 4500,
      startingQuantity: 5,
      shopId: "rightway",
      createdBy: "cashier_rw_01",
    });

    expect(created.product.id).toBeDefined();
    expect(created.product.name).toBe("Wildcraft Compact Sling");
    expect(created.product.productType).toBe("BAG");
    expect(created.product.reviewStatus).toBe("NEEDS_REVIEW");
    expect(created.product.reviewReason).toBe("Quick added at counter");

    expect(created.variant.id).toBeDefined();
    expect(created.variant.productType).toBe("BAG");
    expect(created.variant.reviewStatus).toBe("NEEDS_REVIEW");
    expect(created.variant.sellingPrice).toBe(4500);
    expect(created.variant.barcode).toHaveLength(13);
    expect(isValidEan13(created.variant.barcode)).toBe(true);
    expect(created.variant.sku).toContain("BAG-");
  });

  it("P6: Role permissions for editing product master", async () => {
    const cashier: UserProfile = {
      uid: "cashier_01",
      email: "cashier@pos.lk",
      displayName: "Cashier One",
      role: "CASHIER",
      allowedShopIds: ["rightway"],
      active: true,
    };

    const manager: UserProfile = {
      uid: "manager_01",
      email: "manager@pos.lk",
      displayName: "Manager One",
      role: "SHOP_MANAGER",
      allowedShopIds: ["rightway"],
      active: true,
    };

    const admin: UserProfile = {
      uid: "admin_01",
      email: "admin@pos.lk",
      displayName: "Super Admin",
      role: "SUPER_ADMIN",
      allowedShopIds: ["rightway", "mega"],
      active: true,
    };

    // 1. Cashier cannot edit existing product
    await expect(
      updateProductMaster({
        productId: "prod_clarks_brogue",
        variantId: "var_clk_oxf_blk_41",
        name: "Hacked Clarks",
        user: cashier,
      })
    ).rejects.toThrow(/Cashiers are not permitted to edit existing catalogue products/);

    // 2. Manager cannot edit cost price
    await expect(
      updateProductMaster({
        productId: "prod_clarks_brogue",
        variantId: "var_clk_oxf_blk_41",
        referenceCostPrice: 5000, // Attempt to modify cost
        user: manager,
      })
    ).rejects.toThrow(/Shop Managers are not permitted to edit cost prices/);

    // 3. Manager CAN edit selling price and name
    const updatedByManager = await updateProductMaster({
      productId: "prod_clarks_brogue",
      variantId: "var_clk_oxf_blk_41",
      name: "Clarks Tilden Cap Oxford Updated",
      sellingPrice: 19500,
      user: manager,
    });
    expect(updatedByManager.product.name).toBe("Clarks Tilden Cap Oxford Updated");
    expect(updatedByManager.variant.sellingPrice).toBe(19500);

    // 4. Super Admin CAN edit cost price
    const updatedByAdmin = await updateProductMaster({
      productId: "prod_clarks_brogue",
      variantId: "var_clk_oxf_blk_41",
      referenceCostPrice: 13000,
      user: admin,
    });
    expect(updatedByAdmin.variant.referenceCostPrice).toBe(13000);
  });

  it("P7: Thermal label generator renders 50x30mm, 50x25mm, and 40x30mm formats", () => {
    const variant = getVariants()[0];
    expect(variant).toBeDefined();

    const label50x30 = renderSingleThermalBarcodeLabel(variant, "RightWay Shoes", "50x30mm");
    expect(label50x30).toContain("width: 50mm; height: 30mm");
    expect(label50x30).toContain("RightWay Shoes");
    expect(label50x30).toContain(variant.productNameCache);
    expect(label50x30).toContain(variant.barcode);

    const label50x25 = renderSingleThermalBarcodeLabel(variant, "RightWay Shoes", "50x25mm");
    expect(label50x25).toContain("width: 50mm; height: 25mm");

    const label40x30 = renderSingleThermalBarcodeLabel(variant, "RightWay Shoes", "40x30mm");
    expect(label40x30).toContain("width: 40mm; height: 30mm");
  });

  it("P8: Label printing is hidden from Super Admin role per Section 2.3", () => {
    const admin: UserProfile = {
      uid: "admin_01",
      email: "admin@pos.lk",
      displayName: "Admin",
      role: "SUPER_ADMIN",
      allowedShopIds: ["rightway"],
      active: true,
    };
    const manager: UserProfile = {
      uid: "mgr_01",
      email: "mgr@pos.lk",
      displayName: "Manager",
      role: "SHOP_MANAGER",
      allowedShopIds: ["rightway"],
      active: true,
    };
    const cashier: UserProfile = {
      uid: "cash_01",
      email: "cash@pos.lk",
      displayName: "Cashier",
      role: "CASHIER",
      allowedShopIds: ["rightway"],
      active: true,
    };

    expect(can(admin, "products.print_labels")).toBe(false);
    expect(can(manager, "products.print_labels")).toBe(true);
    expect(can(cashier, "products.print_labels")).toBe(true);
  });
});
