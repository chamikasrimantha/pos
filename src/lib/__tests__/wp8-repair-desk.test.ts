// src/lib/__tests__/wp8-repair-desk.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocalStore,
  saveLocalStore,
  createRepairOrder,
  updateRepairStatus,
  deliverRepairOrder,
  verifyRepairWarranty,
  convertWarrantyRepairToPaid,
  getRepairOrders,
} from "../firestore-service";
import {
  renderRepairIntakeSlipHTML,
  renderRepairDeliveryReceiptHTML,
} from "../receipt-generator";
import { ShoeRepairOrder, Shop, UserProfile, Sale } from "@/types";

describe("WP8. Repair Desk: Bags, Warranty, Billing Estimate (W1 - W8)", () => {
  const shopRightway: Shop = {
    id: "rightway",
    slug: "rightway",
    code: "RW",
    name: "RightWay Shoes",
    address: "Colombo 11",
    phone: "011-2345678",
    repairPrefix: "RW-REP",
    invoicePrefix: "RW-INV",
    shiftPrefix: "RW-SH",
    active: true,
  };

  const cashierUser: UserProfile = {
    uid: "cashier-1",
    id: "cashier-1",
    email: "cashier@rightway.lk",
    displayName: "Ruwan Cashier",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const adminUser: UserProfile = {
    uid: "admin-1",
    id: "admin-1",
    email: "admin@rightway.lk",
    displayName: "Super Admin",
    role: "SUPER_ADMIN",
    allowedShopIds: ["rightway", "mega"],
    active: true,
  };

  beforeEach(() => {
    const store = loadLocalStore();
    store.repairs = [];
    saveLocalStore(store);
  });

  // W1: A school bag repair can be received, tagged, progressed and delivered.
  it("W1: receives a school bag repair, generates intake tag & slip, progresses status and delivers", async () => {
    const order = await createRepairOrder({
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Kamal Perera",
      customerPhone: "0771122334",
      itemType: "BAG",
      subType: "School bag",
      brand: "DSI Bag",
      model: "Ergo Backpack",
      color: "Blue",
      dimension: "18L",
      issueDescription: "Main zip runner detached; left shoulder strap stitch torn",
      hasEstimate: true,
      estimatedCost: 1500,
      advancePaid: 500,
      advancePaymentMethod: "CASH",
      promisedDate: Date.now() + 3 * 86400000,
    });

    expect(order.repairNumber).toMatch(/^RW-REP-\d+$/);
    expect(order.itemType).toBe("BAG");
    expect(order.subType).toBe("School bag");
    expect(order.brand).toBe("DSI Bag");
    expect(order.shoeBrand).toBe("DSI Bag"); // backward compatible
    expect(order.status).toBe("RECEIVED");
    expect(order.balanceDue).toBe(1000);

    // Intake slip and tag rendering
    const slipHTML = renderRepairIntakeSlipHTML(order, shopRightway);
    expect(slipHTML).toContain("REPAIR INTAKE CLAIM SLIP");
    expect(slipHTML).toContain("Kamal Perera");
    expect(slipHTML).toContain("School bag");
    expect(slipHTML).toContain("DSI Bag Ergo Backpack");
    expect(slipHTML).toContain("WORKSHOP BAG ATTACHMENT TAG");

    // Progress status to UNDER_REPAIR
    const inRepair = await updateRepairStatus({
      repairId: order.id,
      newStatus: "UNDER_REPAIR",
      userId: adminUser.uid,
      notes: "Assigned to workshop technician",
    });
    expect(inRepair.status).toBe("UNDER_REPAIR");

    // Progress status to READY_FOR_PICKUP
    const ready = await updateRepairStatus({
      repairId: order.id,
      newStatus: "READY_FOR_PICKUP",
      userId: adminUser.uid,
      notes: "Repair completed",
    });
    expect(ready.status).toBe("READY_FOR_PICKUP");
    expect(ready.completedAt).toBeDefined();

    // Deliver order
    const delivered = await deliverRepairOrder({
      repairId: order.id,
      finalCost: 1500,
      deliveryCashierId: cashierUser.uid,
      deliveryPaymentMethod: "CASH",
    });
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.balanceDue).toBe(0);

    // Delivery invoice
    const delHTML = renderRepairDeliveryReceiptHTML(delivered, shopRightway);
    expect(delHTML).toContain("REPAIR SERVICE INVOICE");
    expect(delHTML).toContain("Kamal Perera");
    expect(delHTML).toContain("DSI Bag Ergo Backpack");
  });

  // W2: With a valid store invoice inside the warranty period the claim shows Verified, the cost is 0, and no payment is requested at delivery.
  it("W2: verifies store invoice inside warranty period, sets cost to 0, delivers with no payment collected", async () => {
    // Seed an invoice created 30 days ago (within 6 months for footwear or 12 months for bags)
    const saleDate = Date.now() - 30 * 86400000;
    const testSale: Sale = {
      id: "sale-w2",
      invoiceNumber: "RW-INV-001050",
      shopId: "rightway",
      cashierId: cashierUser.uid,
      cashierNameCache: "Ruwan Cashier",
      subtotal: 8500,
      discount: 0,
      taxAmount: 0,
      total: 8500,
      amountPaid: 8500,
      balanceDue: 0,
      paymentStatus: "PAID",
      payments: [{ method: "CASH", amount: 8500 }],
      returnStatus: "NONE",
      returnedAmount: 0,
      status: "COMPLETED",
      createdAt: saleDate,
      saleDate,
    };

    const store = loadLocalStore();
    store.sales = [testSale, ...store.sales];
    saveLocalStore(store);

    // Verify warranty
    const verifyRes = verifyRepairWarranty({
      shopId: "rightway",
      invoiceNumber: "RW-INV-001050",
      itemType: "FOOTWEAR",
      callingUser: cashierUser,
    });

    expect(verifyRes.status).toBe("VERIFIED");
    expect(verifyRes.warrantyMonths).toBe(6);
    expect(verifyRes.sale).toBeDefined();

    // Create intake under warranty
    const order = await createRepairOrder({
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Sunil Wickrama",
      customerPhone: "0719876543",
      itemType: "FOOTWEAR",
      subType: "Shoe",
      brand: "RightWay Leather",
      model: "Oxford",
      size: "42",
      color: "Black",
      issueDescription: "Sole detached at toe",
      isWarranty: true,
      warrantyBasis: "STORE_INVOICE",
      warrantyInvoiceNumber: "RW-INV-001050",
      warrantyStatus: "VERIFIED",
      promisedDate: Date.now() + 2 * 86400000,
    });

    expect(order.isWarranty).toBe(true);
    expect(order.estimatedCost).toBe(0);
    expect(order.advancePaid).toBe(0);
    expect(order.finalCost).toBe(0);
    expect(order.balanceDue).toBe(0);
    expect(order.warrantyStatus).toBe("VERIFIED");

    // Check intake slip
    const slipHTML = renderRepairIntakeSlipHTML(order, shopRightway);
    expect(slipHTML).toContain("WARRANTY CLAIM — NO CHARGE");
    expect(slipHTML).toContain("Store Invoice #RW-INV-001050");

    // Progress to delivery
    await updateRepairStatus({ repairId: order.id, newStatus: "READY_FOR_PICKUP", userId: adminUser.uid });

    const delivered = await deliverRepairOrder({
      repairId: order.id,
      deliveryCashierId: cashierUser.uid,
    });

    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.finalCost).toBe(0);
    expect(delivered.balanceDue).toBe(0);
    expect(delivered.deliveryPaymentMethod).toBeNull();

    // Check delivery invoice
    const delHTML = renderRepairDeliveryReceiptHTML(delivered, shopRightway);
    expect(delHTML).toContain("Warranty service — no charge");
    expect(delHTML).toContain("Repair workmanship warranty");
  });

  // W3: An invoice outside the period shows Expired and the switch stays off.
  it("W3: identifies expired warranty for sales older than the warranty period", async () => {
    // 200 days ago is > 6 months (approx 180 days) for footwear
    const oldSaleDate = Date.now() - 200 * 86400000;
    const testSale: Sale = {
      id: "sale-w3",
      invoiceNumber: "RW-INV-000500",
      shopId: "rightway",
      cashierId: cashierUser.uid,
      cashierNameCache: "Ruwan Cashier",
      subtotal: 5000,
      discount: 0,
      taxAmount: 0,
      total: 5000,
      amountPaid: 5000,
      balanceDue: 0,
      paymentStatus: "PAID",
      payments: [{ method: "CASH", amount: 5000 }],
      returnStatus: "NONE",
      returnedAmount: 0,
      status: "COMPLETED",
      createdAt: oldSaleDate,
      saleDate: oldSaleDate,
    };

    const store = loadLocalStore();
    store.sales = [testSale, ...store.sales];
    saveLocalStore(store);

    const verifyRes = verifyRepairWarranty({
      shopId: "rightway",
      invoiceNumber: "RW-INV-000500",
      itemType: "FOOTWEAR",
      callingUser: cashierUser,
    });

    expect(verifyRes.status).toBe("EXPIRED");
    expect(verifyRes.message).toContain("Warranty expired");
  });

  // W4: A manual warranty is saved as Unverified and appears in the Review Inbox.
  it("W4: manual warranty is saved as UNVERIFIED with needsReview: true", async () => {
    const order = await createRepairOrder({
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Nimal Fernando",
      customerPhone: "0778899001",
      itemType: "BAG",
      subType: "Luggage bag",
      brand: "VIP",
      model: "Skyline 28",
      color: "Silver",
      dimension: "28 inch",
      issueDescription: "Wheel broken during travel",
      isWarranty: true,
      warrantyBasis: "MANUAL",
      warrantyCardNumber: "CARD-88321-MANUAL",
      promisedDate: Date.now() + 4 * 86400000,
    });

    expect(order.isWarranty).toBe(true);
    expect(order.warrantyBasis).toBe("MANUAL");
    expect(order.warrantyStatus).toBe("UNVERIFIED");
    expect(order.needsReview).toBe(true);
    expect(order.estimatedCost).toBe(0);
    expect(order.advancePaid).toBe(0);

    const slipHTML = renderRepairIntakeSlipHTML(order, shopRightway);
    expect(slipHTML).toContain("WARRANTY CLAIM — NO CHARGE");
    expect(slipHTML).toContain("Manual Card #CARD-88321-MANUAL");
    expect(slipHTML).toContain("UNVERIFIED");
  });

  // W5: Turning the estimate off prints "Estimate to be advised" and allows a final cost at delivery.
  it("W5: turning estimate off prints 'Estimate to be advised' and accepts final cost at delivery", async () => {
    const order = await createRepairOrder({
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Anura Silva",
      customerPhone: "0723344556",
      itemType: "FOOTWEAR",
      subType: "Boot",
      brand: "Cat",
      model: "Colorado Work Boot",
      size: "44",
      color: "Honey",
      issueDescription: "Needs total sole reconstruction; technician must inspect first",
      hasEstimate: false,
      promisedDate: Date.now() + 5 * 86400000,
    });

    expect(order.hasEstimate).toBe(false);
    expect(order.estimatedCost).toBe(0);
    expect(order.advancePaid).toBe(0);
    expect(order.balanceDue).toBe(0);

    // Intake slip prints "Estimate to be advised"
    const slipHTML = renderRepairIntakeSlipHTML(order, shopRightway);
    expect(slipHTML).toContain("Estimate to be advised");

    // Progress to delivery
    await updateRepairStatus({ repairId: order.id, newStatus: "READY_FOR_PICKUP", userId: adminUser.uid });

    // Deliver with final cost entered at delivery
    const delivered = await deliverRepairOrder({
      repairId: order.id,
      finalCost: 4500,
      deliveryCashierId: cashierUser.uid,
      deliveryPaymentMethod: "CASH",
    });

    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.finalCost).toBe(4500);
    expect(delivered.balanceDue).toBe(0);

    const delHTML = renderRepairDeliveryReceiptHTML(delivered, shopRightway);
    expect(delHTML).toContain("Total Service Charge:");
    expect(delHTML).toContain("4,500.00");
  });

  // W6: Old repair records (before this change) still open and print.
  it("W6: old legacy repair order without new fields opens and prints cleanly", () => {
    const legacyRepair: ShoeRepairOrder = {
      id: "rep-legacy-01",
      repairNumber: "RW-REP-000001",
      shopId: "rightway",
      intakeCashierId: "cashier-old",
      customerName: "Old Customer",
      customerPhone: "0712345678",
      shoeBrand: "Clarks",
      shoeModel: "Desert Boot",
      shoeSize: "41",
      shoeColor: "Beige",
      isStorePurchased: false,
      issueDescription: "Heel replacement",
      estimatedCost: 1800,
      advancePaid: 500,
      finalCost: 1800,
      balanceDue: 1300,
      status: "DELIVERED",
      receivedAt: Date.now() - 50 * 86400000,
      deliveredAt: Date.now() - 45 * 86400000,
      promisedDate: Date.now() - 46 * 86400000,
      statusHistory: [],
    };

    // Both slips should render without error
    const intakeHTML = renderRepairIntakeSlipHTML(legacyRepair, shopRightway);
    expect(intakeHTML).toContain("Clarks Desert Boot");
    expect(intakeHTML).toContain("Beige");
    expect(intakeHTML).toContain("Size 41");

    const delHTML = renderRepairDeliveryReceiptHTML(legacyRepair, shopRightway);
    expect(delHTML).toContain("Clarks Desert Boot");
    expect(delHTML).toContain("1,300.00");
  });

  // W7: Slip and tag print inside their labels for long repair numbers.
  it("W7: prints barcode using short scan code inside workshop tag for long repair numbers", () => {
    const longRepair: ShoeRepairOrder = {
      id: "rep-long-99",
      repairNumber: "RW-REP-20261101-9988776655",
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Very Long Name Customer",
      customerPhone: "0771234567",
      itemType: "FOOTWEAR",
      subType: "Shoe",
      shoeBrand: "RightWay",
      shoeModel: "Classic",
      shoeSize: "42",
      shoeColor: "Black",
      isStorePurchased: true,
      issueDescription: "Restitching sole",
      estimatedCost: 2000,
      advancePaid: 0,
      finalCost: 2000,
      balanceDue: 2000,
      status: "RECEIVED",
      receivedAt: Date.now(),
      promisedDate: Date.now() + 86400000,
      statusHistory: [],
    };

    const html = renderRepairIntakeSlipHTML(longRepair, shopRightway);
    expect(html).toContain("WORKSHOP SHOE ATTACHMENT TAG");
    // Short code barcode (last segment)
    expect(html).toContain("9988776655");
    expect(html).toContain("max-width: 280px");
  });

  // W8: A cashier cannot convert a warranty repair to paid; the Super Admin can.
  it("W8: only Super Admin can convert a warranty repair to paid; cashier attempt is refused", async () => {
    const warrantyOrder = await createRepairOrder({
      shopId: "rightway",
      intakeCashierId: cashierUser.uid,
      customerName: "Test Customer",
      customerPhone: "0770001122",
      itemType: "BAG",
      subType: "Travel bag",
      brand: "Samsonite",
      model: "Duffle",
      color: "Navy",
      issueDescription: "Torn side pocket",
      isWarranty: true,
      warrantyBasis: "MANUAL",
      warrantyCardNumber: "MANUAL-001",
      promisedDate: Date.now() + 2 * 86400000,
    });

    expect(warrantyOrder.isWarranty).toBe(true);
    expect(warrantyOrder.estimatedCost).toBe(0);

    // Cashier attempts to convert to paid -> refused
    await expect(
      convertWarrantyRepairToPaid({
        repairId: warrantyOrder.id,
        estimatedCost: 3000,
        callingUser: cashierUser,
        reason: "Customer caused physical damage with a knife",
      })
    ).rejects.toThrow("PERMISSION_DENIED");

    // Super Admin converts to paid -> succeeds
    const converted = await convertWarrantyRepairToPaid({
      repairId: warrantyOrder.id,
      estimatedCost: 3000,
      callingUser: adminUser,
      reason: "Customer caused physical damage with a sharp object",
    });

    expect(converted.isWarranty).toBe(false);
    expect(converted.isWarrantyConvertedToPaid).toBe(true);
    expect(converted.estimatedCost).toBe(3000);
    expect(converted.balanceDue).toBe(3000);
    expect(converted.hasEstimate).toBe(true);
    expect(converted.convertedToPaidBy).toBe(adminUser.uid);
  });
});
