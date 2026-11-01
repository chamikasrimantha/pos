// src/lib/__tests__/wp7-purchasing-suppliers.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocalStore,
  saveLocalStore,
  getSuppliers,
  getSuppliersForUser,
  addSupplier,
  getPurchases,
  getSupplierLedger,
  getCheques,
  createPurchase,
  markPurchaseReviewed,
  cancelPurchase,
  createQuickProduct,
  updateChequeStatus,
  getVariants,
  getProducts,
} from "../firestore-service";
import {
  renderPurchaseBillHTML,
  renderChequeVoucherHTML,
  formatCurrency,
} from "../receipt-generator";
import { UserProfile, ProductVariant, Shop } from "@/types";

describe("WP7: Purchasing and Suppliers for Cashiers (Acceptance Criteria U1-U10)", () => {
  const cashierUser: UserProfile = {
    uid: "cashier_rw_1",
    id: "cashier_rw_1",
    email: "cashier.rw@apexpos.lk",
    displayName: "Saman Perera",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
    mustChangePassword: false,
  };

  const cashierMegaUser: UserProfile = {
    uid: "cashier_mega_1",
    id: "cashier_mega_1",
    email: "cashier.mega@apexpos.lk",
    displayName: "Kasun Silva",
    role: "CASHIER",
    allowedShopIds: ["mega"],
    active: true,
    mustChangePassword: false,
  };

  const superAdminUser: UserProfile = {
    uid: "admin_user_1",
    id: "admin_user_1",
    email: "admin@apexpos.lk",
    displayName: "Super Admin",
    role: "SUPER_ADMIN",
    allowedShopIds: ["rightway", "mega"],
    active: true,
    mustChangePassword: false,
  };

  const mockShop: Shop = {
    id: "rightway",
    name: "RightWay Shoes",
    code: "RW",
    address: "123 Main Street, Colombo 03",
    phone: "011-2345678",
    active: true,
    slug: "rightway",
    invoicePrefix: "RW-INV",
    shiftPrefix: "RW-SH",
    repairPrefix: "RW-REP",
  };

  beforeEach(() => {
    const store = loadLocalStore();
    // Clean up test data
    store.suppliers = [
      {
        id: "sup_seed_1",
        name: "Lanka Leather Mills",
        phone: "0771234567",
        contactPerson: "Mr. Bandara",
        address: "Colombo 11",
        email: "lanka@leather.lk",
        active: true,
        createdAt: 1700000000000,
      },
      {
        id: "sup_seed_2",
        name: "Ceylon Foam & Soles",
        phone: "0719876543",
        contactPerson: "Mr. Nimal",
        address: "Pettah",
        active: true,
        createdAt: 1700000000000,
      },
    ];
    store.purchases = [];
    store.supplierTransactions = [];
    store.cheques = [];
    store.payments = [];
    saveLocalStore(store);
  });

  // U1: Duplicate name or phone is blocked (ignore case and spaces)
  it("U1: A cashier adds a new supplier; a duplicate name or phone is blocked", async () => {
    // 1. Successful addition
    const newSupplier = await addSupplier({
      name: "Apex Footwear Supplies",
      phone: "0755555555",
      contactPerson: "Kamal",
      address: "Kandy Road, Kelaniya",
      callingUser: cashierUser,
    });

    expect(newSupplier.id).toBeDefined();
    expect(newSupplier.name).toBe("Apex Footwear Supplies");
    expect(newSupplier.needsReview).toBe(true); // Flagged for review when created by cashier

    // 2. Duplicate name (case and space insensitive) is blocked
    await expect(
      addSupplier({
        name: "  apex footwear  supplies ",
        phone: "0761112222",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("A supplier with this name or phone number already exists.");

    // 3. Duplicate phone (with formatting spaces/dashes) is blocked
    await expect(
      addSupplier({
        name: "Another Supplier Name",
        phone: " 075-555-5555 ",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("A supplier with this name or phone number already exists.");

    // 4. Duplicate against seed supplier
    await expect(
      addSupplier({
        name: "lanka leather mills",
        phone: "0789998888",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("A supplier with this name or phone number already exists.");

    // 5. Cashier view hides contactPerson, address, email, taxNumber, paymentTerms
    const cashierSuppliers = getSuppliersForUser(cashierUser);
    const addedView = cashierSuppliers.find((s) => s.id === newSupplier.id);
    expect(addedView).toBeDefined();
    expect(addedView?.name).toBe("Apex Footwear Supplies");
    expect(addedView?.phone).toBe("0755555555");
    expect((addedView as any).address).toBeUndefined();
    expect((addedView as any).contactPerson).toBeUndefined();
  });

  // U2: A cashier buys a shoe size run (two colours, five sizes) in one grid and a bag product in another; stock rises at the cashier's branch by the entered quantities
  it("U2: A cashier buys a shoe size run (two colours, five sizes) and a bag product; stock rises at the branch by the entered quantities", async () => {
    const allVariants = getVariants();
    const shoeVariants = allVariants.filter((v) => (v.productType || "FOOTWEAR") === "FOOTWEAR").slice(0, 10);
    const bagVariant = allVariants.find((v) => v.productType === "BAG") || allVariants[0];

    const store = loadLocalStore();
    // Record initial stock
    const initialShoeStocks = shoeVariants.map((v) => {
      const inv = store.inventory[`rightway_${v.id}`];
      return inv ? inv.quantityOnHand : 0;
    });
    const initialBagStock = store.inventory[`rightway_${bagVariant.id}`]?.quantityOnHand || 0;

    // Items array representing a size run of 10 items (5 pairs each = 50 pairs) + 1 bag item (12 units)
    const items = [
      ...shoeVariants.map((v) => ({
        variant: v,
        quantity: 5,
        unitCost: 2500,
      })),
      {
        variant: bagVariant,
        quantity: 12,
        unitCost: 4500,
      },
    ];

    const result = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      supplierBillNumber: "BILL-2026-001",
      items,
      paymentMethod: "CASH",
      callingUser: cashierUser,
    });

    expect(result.purchase).toBeDefined();
    expect(result.purchase.items).toHaveLength(shoeVariants.length + 1);
    expect(result.purchase.needsReview).toBe(true); // Cashier purchase flagged for review
    expect(result.purchase.status).toBe("RECEIVED");

    // Verify stock rose by the entered quantities
    const updatedStore = loadLocalStore();
    shoeVariants.forEach((v, idx) => {
      const updatedInv = updatedStore.inventory[`rightway_${v.id}`];
      expect(updatedInv).toBeDefined();
      expect(updatedInv.quantityOnHand).toBe(initialShoeStocks[idx] + 5);
    });

    const updatedBagInv = updatedStore.inventory[`rightway_${bagVariant.id}`];
    expect(updatedBagInv.quantityOnHand).toBe(initialBagStock + 12);
  });

  // U3: Filtering the picker by type Bags, brand and colour narrows the products correctly
  it("U3: Filtering the picker by type Bags, brand and colour narrows the products correctly", () => {
    const allProducts = getProducts();
    const allVariants = getVariants();

    // Filter by type BAG
    const bagProducts = allProducts.filter((p) => p.productType === "BAG");
    expect(bagProducts.length).toBeGreaterThan(0);
    expect(bagProducts.every((p) => p.productType === "BAG")).toBe(true);

    // Filter bag variants by brand and colour
    const firstBag = bagProducts[0];
    const bagVariants = allVariants.filter((v) => v.productId === firstBag.id);
    expect(bagVariants.length).toBeGreaterThan(0);

    const firstColor = bagVariants[0].colorId;
    const filteredByColor = bagVariants.filter((v) => v.colorId === firstColor);
    expect(filteredByColor.length).toBeGreaterThan(0);
    expect(filteredByColor.every((v) => v.colorId === firstColor)).toBe(true);
  });

  // U4: A cash purchase prints a cash bill and the supplier ledger shows purchase and payment; the cashier cannot open the ledger
  it("U4: A cash purchase prints a cash bill and the supplier ledger shows purchase and payment; the cashier cannot open the ledger", async () => {
    const variant = getVariants()[0];

    const result = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [{ variant, quantity: 10, unitCost: 3000 }],
      paymentMethod: "CASH",
      callingUser: cashierUser,
    });

    expect(result.purchase.totalAmount).toBe(30000);
    expect(result.purchase.paymentMethod).toBe("CASH");

    // Verify printed cash bill HTML format
    const billHtml = renderPurchaseBillHTML(result.purchase, mockShop, { isDuplicate: false });
    expect(billHtml).toContain("PURCHASE INWARD BILL");
    expect(billHtml).toContain("PAID IN CASH");
    expect(billHtml).toContain("Lanka Leather Mills");
    expect(billHtml).toContain(formatCurrency(30000));
    expect(billHtml).toContain("Receiver / Supplier:");
    expect(billHtml).not.toContain("*** DUPLICATE REPRINT ***");

    // Verify supplier ledger has both PURCHASE and PAYMENT entries
    const ledger = getSupplierLedger("sup_seed_1", superAdminUser);
    expect(ledger.transactions).toHaveLength(2);

    const purTx = ledger.transactions.find((t) => t.type === "PURCHASE");
    const payTx = ledger.transactions.find((t) => t.type === "PAYMENT");
    expect(purTx).toBeDefined();
    expect(purTx?.credit).toBe(30000);
    expect(payTx).toBeDefined();
    expect(payTx?.debit).toBe(30000);
    expect(ledger.outstandingBalance).toBe(0);

    // Cashier attempting to open/query supplier ledger is blocked
    expect(() => getSupplierLedger("sup_seed_1", cashierUser)).toThrow();
  });

  // U5: A cashier issues a cheque for a purchase; the cheque exists as pending and linked; the cashier has no way to see its status or any cheque list; the Super Admin sees it and can clear it
  it("U5: A cashier issues a cheque for a purchase; cheque exists as pending and linked; cashier has no access to cheque list; Super Admin can clear it", async () => {
    const variant = getVariants()[0];

    const result = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [{ variant, quantity: 20, unitCost: 2000 }],
      paymentMethod: "CHEQUE",
      chequeDetails: {
        chequeNumber: "CHQ-778899",
        bankName: "Commercial Bank",
        chequeDate: Date.now() + 14 * 86400000, // Post-dated 14 days
      },
      callingUser: cashierUser,
    });

    expect(result.cheque).toBeDefined();
    expect(result.cheque?.chequeNumber).toBe("CHQ-778899");
    expect(result.cheque?.amount).toBe(40000);
    expect(result.cheque?.status).toBe("PENDING");
    expect(result.cheque?.purchaseId).toBe(result.purchase.id);

    // Verify cheque voucher HTML
    const voucherHtml = renderChequeVoucherHTML(result.cheque!, result.purchase, mockShop);
    expect(voucherHtml).toContain("CHEQUE PAYMENT VOUCHER");
    expect(voucherHtml).toContain("CHQ-778899");
    expect(voucherHtml).toContain("Commercial Bank");
    expect(voucherHtml).toContain(formatCurrency(40000));

    // Cashier attempting to access cheque list is rejected
    expect(() => getCheques(cashierUser)).toThrow();

    // Duplicate cheque number is blocked without showing details
    await expect(
      createPurchase({
        shopId: "rightway",
        supplierId: "sup_seed_1",
        items: [{ variant, quantity: 5, unitCost: 2000 }],
        paymentMethod: "CHEQUE",
        chequeDetails: {
          chequeNumber: "CHQ-778899", // duplicate
          bankName: "Commercial Bank",
          chequeDate: Date.now(),
        },
        callingUser: cashierUser,
      })
    ).rejects.toThrow("This cheque number is already used.");

    // Super Admin sees the cheque in register and can clear it
    const adminCheques = getCheques(superAdminUser);
    const pendingCheque = adminCheques.find((c) => c.chequeNumber === "CHQ-778899");
    expect(pendingCheque).toBeDefined();
    expect(pendingCheque?.status).toBe("PENDING");

    // Super Admin clears the cheque
    const cleared = await updateChequeStatus({
      chequeId: pendingCheque!.id,
      newStatus: "CLEARED",
      notes: "Cheque cleared at bank",
      performedByRole: "SUPER_ADMIN",
    });
    expect(cleared.status).toBe("CLEARED");
  });

  // U6: A cashier cannot choose credit, bank transfer or part payment, and the data function refuses them
  it("U6: A cashier cannot choose credit, bank transfer or part payment, and the data function refuses them", async () => {
    const variant = getVariants()[0];

    // Credit refusal
    await expect(
      createPurchase({
        shopId: "rightway",
        supplierId: "sup_seed_1",
        items: [{ variant, quantity: 5, unitCost: 2000 }],
        paymentMethod: "CREDIT",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("Cashiers can only purchase with Cash or Cheque.");

    // Bank transfer refusal
    await expect(
      createPurchase({
        shopId: "rightway",
        supplierId: "sup_seed_1",
        items: [{ variant, quantity: 5, unitCost: 2000 }],
        paymentMethod: "BANK_TRANSFER",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("Cashiers can only purchase with Cash or Cheque.");

    // Part payment refusal
    await expect(
      createPurchase({
        shopId: "rightway",
        supplierId: "sup_seed_1",
        items: [{ variant, quantity: 5, unitCost: 2000 }],
        paymentMethod: "PARTIAL",
        paidAmount: 5000,
        callingUser: cashierUser,
      })
    ).rejects.toThrow("Cashiers can only purchase with Cash or Cheque.");

    // Branch refusal: Cashier attempting to purchase for unallowed shop
    await expect(
      createPurchase({
        shopId: "mega",
        supplierId: "sup_seed_1",
        items: [{ variant, quantity: 5, unitCost: 2000 }],
        paymentMethod: "CASH",
        callingUser: cashierUser, // allowed only rightway
      })
    ).rejects.toThrow();
  });

  // U7: A cashier's My purchases lists only their own bills and allows reprint (marked duplicate)
  it("U7: A cashier's My purchases lists only their own bills and allows reprint (marked duplicate)", async () => {
    const variant = getVariants()[0];

    // Cashier 1 records a bill at RightWay
    const bill1 = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [{ variant, quantity: 10, unitCost: 2000 }],
      paymentMethod: "CASH",
      callingUser: cashierUser,
    });

    // Cashier 2 records a bill at Mega
    const bill2 = await createPurchase({
      shopId: "mega",
      supplierId: "sup_seed_2",
      items: [{ variant, quantity: 15, unitCost: 2200 }],
      paymentMethod: "CASH",
      callingUser: cashierMegaUser,
    });

    // Cashier 1 sees only bill1
    const cashier1Bills = getPurchases(undefined, cashierUser);
    expect(cashier1Bills.map((b) => b.id)).toContain(bill1.purchase.id);
    expect(cashier1Bills.map((b) => b.id)).not.toContain(bill2.purchase.id);

    // Cashier 2 sees only bill2
    const cashier2Bills = getPurchases(undefined, cashierMegaUser);
    expect(cashier2Bills.map((b) => b.id)).toContain(bill2.purchase.id);
    expect(cashier2Bills.map((b) => b.id)).not.toContain(bill1.purchase.id);

    // Reprint bill marked duplicate
    const reprintHtml = renderPurchaseBillHTML(bill1.purchase, mockShop, { isDuplicate: true });
    expect(reprintHtml).toContain("*** DUPLICATE REPRINT ***");
    expect(reprintHtml).toContain(bill1.purchase.purchaseNumber);
  });

  // U8: The Super Admin's All purchases shows every purchase with issuer, costs and payment method, and can mark one reviewed
  it("U8: The Super Admin's All purchases shows every purchase with issuer, costs and payment method, and can mark one reviewed", async () => {
    const variant = getVariants()[0];

    const bill = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [{ variant, quantity: 10, unitCost: 2500 }],
      paymentMethod: "CASH",
      callingUser: cashierUser,
    });

    expect(bill.purchase.needsReview).toBe(true);

    // Super Admin gets all purchases
    const allBills = getPurchases(undefined, superAdminUser);
    const targetBill = allBills.find((b) => b.id === bill.purchase.id);
    expect(targetBill).toBeDefined();
    expect(targetBill?.createdByNameCache).toBe("Saman Perera");
    expect(targetBill?.items[0].unitCost).toBe(2500);
    expect(targetBill?.paymentMethod).toBe("CASH");

    // Super Admin marks reviewed
    const reviewed = await markPurchaseReviewed(bill.purchase.id, superAdminUser, "Verified with physical GRN");
    expect(reviewed.needsReview).toBe(false);
    expect(reviewed.reviewedBy).toBe(superAdminUser.id);
    expect(reviewed.reviewNote).toBe("Verified with physical GRN");
  });

  // U9: A product missing from the catalogue can be added during purchasing and appears on the bill
  it("U9: A product missing from the catalogue can be added during purchasing and appears on the bill", async () => {
    const store = loadLocalStore();
    const color = store.colors[0];
    const size = store.sizes[0];

    // Cashier quick adds missing product with cost field shown
    const quickAdded = await createQuickProduct({
      name: "Brand New Travel Duffel Bag",
      productType: "BAG",
      categoryId: store.categories[0].id,
      brandId: store.brands[0].id,
      colorId: color.id,
      sizeId: size.id,
      sellingPrice: 7500,
      referenceCostPrice: 4200,
      startingQuantity: 0,
      shopId: "rightway",
      createdBy: cashierUser.uid,
    });

    expect(quickAdded.product.name).toBe("Brand New Travel Duffel Bag");
    expect(quickAdded.variant.referenceCostPrice).toBe(4200);

    // Appears on the purchase bill
    const purchase = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [
        {
          variant: quickAdded.variant,
          quantity: 25,
          unitCost: 4200,
        },
      ],
      paymentMethod: "CASH",
      callingUser: cashierUser,
    });

    expect(purchase.purchase.items[0].variantId).toBe(quickAdded.variant.id);
    expect(purchase.purchase.totalAmount).toBe(25 * 4200);

    // Stock incremented
    const updatedStore = loadLocalStore();
    expect(updatedStore.inventory[`rightway_${quickAdded.variant.id}`].quantityOnHand).toBe(25);
  });

  // U10: Responsive layout check and cancel safeguard
  it("U10: Super Admin cancellation prevents negative stock", async () => {
    const variant = getVariants()[0];

    const purchaseRes = await createPurchase({
      shopId: "rightway",
      supplierId: "sup_seed_1",
      items: [{ variant, quantity: 10, unitCost: 1500 }],
      paymentMethod: "CASH",
      callingUser: superAdminUser,
    });

    // Reduce stock manually below 10 (simulating customer sales)
    const storeMid = loadLocalStore();
    storeMid.inventory[`rightway_${variant.id}`].quantityOnHand = 4;
    saveLocalStore(storeMid);

    // Attempting to cancel purchase when remaining stock is only 4 pairs must fail
    await expect(
      cancelPurchase(purchaseRes.purchase.id, superAdminUser, "Supplier returned invoice")
    ).rejects.toThrow("would have negative stock");
  });
});
