// src/lib/__tests__/wp5-customers-credit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  completeSale,
  processCustomerReturn,
  createCustomer,
  updateCustomer,
  receiveCustomerPayment,
  issueCashAdvance,
  adjustCustomerBalance,
  getCustomerById,
  getCustomerBalance,
  getCustomerLedger,
  getAllOutstandingCreditCustomers,
  getDailySalesData,
  getVariants,
  resetLocalStoreForTesting,
} from "../firestore-service";
import { UserProfile, ProductVariant } from "@/types";

describe("WP5: Customers, Credit Sales, Customer Ledger, FIFO Settlement, and Cash Advances", () => {
  beforeEach(() => {
    resetLocalStoreForTesting();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  const sampleCashier: UserProfile = {
    uid: "cashier_rightway",
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

  it("C1: Credit sale with no customer is refused; with customer creates CREDIT payment and ledger entry", async () => {
    const variant = getVariants().find((v) => v.id === "var_clk_oxf_blk_41")!;
    expect(variant).toBeDefined();

    // 1. Credit sale with NO customer should be rejected
    await expect(
      completeSale({
        shopId: "rightway",
        cashierId: sampleCashier.uid,
        cashierName: sampleCashier.displayName,
        items: [
          {
            variant,
            quantity: 1,
            unitPrice: 10000,
            listPrice: 10000,
            priceOverridden: false,
            discount: 0,
            lineTotal: 10000,
          },
        ],
        subtotal: 10000,
        discount: 0,
        taxAmount: 0,
        total: 10000,
        payments: [{ method: "CREDIT", amount: 10000 }],
      })
    ).rejects.toThrow(/customer is required for credit sales/i);

    // 2. Create customer and complete credit sale
    const customer = await createCustomer({
      name: "Sunil Silva",
      phone: "0771122334",
      type: "REGULAR",
      creditLimit: 50000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    const saleResult = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 10000,
          listPrice: 10000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 10000,
        },
      ],
      subtotal: 10000,
      discount: 0,
      taxAmount: 0,
      total: 10000,
      payments: [{ method: "CREDIT", amount: 10000 }],
    });

    expect(saleResult.sale.paymentStatus).toBe("CREDIT");
    expect(saleResult.sale.amountPaid).toBe(0);
    expect(saleResult.sale.balanceDue).toBe(10000);
    expect(saleResult.sale.customerId).toBe(customer.id);

    // Ledger check
    const ledger = getCustomerLedger(customer.id);
    const creditSaleEntry = ledger.find((e) => e.type === "CREDIT_SALE");
    expect(creditSaleEntry).toBeDefined();
    expect(creditSaleEntry?.direction).toBe("DEBIT");
    expect(creditSaleEntry?.amount).toBe(10000);

    // Customer balance check
    expect(getCustomerBalance(customer.id)).toBe(10000);
  });

  it("C2: Sale of 20,000 with 5,000 paid now in cash and rest on credit gives PARTIALLY_PAID, balance 15,000", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Nimal Fernando",
      phone: "0772233445",
      type: "REGULAR",
      creditLimit: 50000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    const saleResult = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 2,
          unitPrice: 10000,
          listPrice: 10000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 20000,
        },
      ],
      subtotal: 20000,
      discount: 0,
      taxAmount: 0,
      total: 20000,
      payments: [
        { method: "CASH", amount: 5000 },
        { method: "CREDIT", amount: 15000 },
      ],
    });

    expect(saleResult.sale.paymentStatus).toBe("PARTIALLY_PAID");
    expect(saleResult.sale.amountPaid).toBe(5000);
    expect(saleResult.sale.balanceDue).toBe(15000);

    // Ledger records only the credit portion as debt
    const ledger = getCustomerLedger(customer.id);
    const creditEntry = ledger.find((e) => e.type === "CREDIT_SALE");
    expect(creditEntry?.amount).toBe(15000);
    expect(creditEntry?.direction).toBe("DEBIT");
    expect(getCustomerBalance(customer.id)).toBe(15000);
  });

  it("C3: Receiving 10,000 settles oldest credit invoice first (FIFO) and updates status; receipt lists settled invoices", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Ruwan Wijesinghe",
      phone: "0773344556",
      type: "REGULAR",
      creditLimit: 50000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    // Invoice 1: 6,000 on credit
    const res1 = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 6000,
          listPrice: 6000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 6000,
        },
      ],
      subtotal: 6000,
      discount: 0,
      taxAmount: 0,
      total: 6000,
      payments: [{ method: "CREDIT", amount: 6000 }],
    });

    // Invoice 2: 8,000 on credit
    const res2 = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 8000,
          listPrice: 8000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 8000,
        },
      ],
      subtotal: 8000,
      discount: 0,
      taxAmount: 0,
      total: 8000,
      payments: [{ method: "CREDIT", amount: 8000 }],
    });

    expect(getCustomerBalance(customer.id)).toBe(14000);

    // Receive 10,000 payment from customer
    const receipt = await receiveCustomerPayment({
      customerId: customer.id,
      shopId: "rightway",
      amount: 10000,
      method: "CASH",
      receivedBy: sampleCashier.uid,
      receivedByName: sampleCashier.displayName,
    });

    expect(receipt.amount).toBe(10000);
    expect(receipt.settledInvoices).toHaveLength(2);

    // Invoice 1 settled completely
    const settled1 = receipt.settledInvoices.find((s) => s.saleId === res1.sale.id);
    expect(settled1).toBeDefined();
    expect(settled1?.amountApplied).toBe(6000);
    expect(settled1?.balanceRemaining).toBe(0);

    // Invoice 2 partially settled
    const settled2 = receipt.settledInvoices.find((s) => s.saleId === res2.sale.id);
    expect(settled2).toBeDefined();
    expect(settled2?.amountApplied).toBe(4000);
    expect(settled2?.balanceRemaining).toBe(4000);

    // Balance remaining on customer
    expect(getCustomerBalance(customer.id)).toBe(4000);
  });

  it("C4: Credit limit stops a sale that would exceed it", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Kusal Mendis",
      phone: "0774455667",
      type: "REGULAR",
      creditLimit: 10000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    // First credit sale of 8,000 (within 10,000 limit)
    await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 8000,
          listPrice: 8000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 8000,
        },
      ],
      subtotal: 8000,
      discount: 0,
      taxAmount: 0,
      total: 8000,
      payments: [{ method: "CREDIT", amount: 8000 }],
    });

    expect(getCustomerBalance(customer.id)).toBe(8000);

    // Second credit sale of 3,000 would result in 11,000 > 10,000 limit -> Must throw!
    await expect(
      completeSale({
        shopId: "rightway",
        cashierId: sampleCashier.uid,
        cashierName: sampleCashier.displayName,
        customerId: customer.id,
        items: [
          {
            variant,
            quantity: 1,
            unitPrice: 3000,
            listPrice: 3000,
            priceOverridden: false,
            discount: 0,
            lineTotal: 3000,
          },
        ],
        subtotal: 3000,
        discount: 0,
        taxAmount: 0,
        total: 3000,
        payments: [{ method: "CREDIT", amount: 3000 }],
      })
    ).rejects.toThrow(/Credit limit reached/i);
  });

  it("C5: Returning goods from credit invoice reduces balance before refunding cash", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Anura Bandara",
      phone: "0775566778",
      type: "REGULAR",
      creditLimit: 50000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    // Sale of 5,000 completely on credit (balanceDue = 5000)
    const saleResult = await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 5000,
          listPrice: 5000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 5000,
        },
      ],
      subtotal: 5000,
      discount: 0,
      taxAmount: 0,
      total: 5000,
      payments: [{ method: "CREDIT", amount: 5000 }],
    });

    expect(getCustomerBalance(customer.id)).toBe(5000);

    // Return the item
    const returnRecord = await processCustomerReturn({
      originalSale: saleResult.sale,
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      items: [
        {
          variantId: variant.id,
          quantity: 1,
          unitPriceRefunded: 5000,
          condition: "NEW_RESELLABLE",
          restocked: true,
          reason: "SIZE_FIT",
        },
      ],
      refundMethod: "CASH",
    });

    // Net cash refund must be 0 because balance was reduced instead!
    expect(returnRecord.netRefundAmount).toBe(0);
    expect(getCustomerBalance(customer.id)).toBe(0);

    const ledger = getCustomerLedger(customer.id);
    const returnEntry = ledger.find((e) => e.type === "RETURN_ADJUSTMENT");
    expect(returnEntry).toBeDefined();
    expect(returnEntry?.direction).toBe("CREDIT");
    expect(returnEntry?.amount).toBe(5000);
  });

  it("C6: Cashier cannot record cash advance, adjust, or write off balance; Super Admin can", async () => {
    const customer = await createCustomer({
      name: "Staff Member Mahesh",
      phone: "0776677889",
      type: "STAFF",
      creditLimit: 30000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    // Cashier attempts cash advance -> Refused
    await expect(
      issueCashAdvance({
        customerId: customer.id,
        shopId: "rightway",
        amount: 5000,
        issuedBy: sampleCashier.uid,
        issuedByName: sampleCashier.displayName,
      })
    ).rejects.toThrow(/Only Super Admin can issue cash advances/i);

    // Super Admin issues cash advance -> Success
    const advance = await issueCashAdvance({
      customerId: customer.id,
      shopId: "rightway",
      amount: 5000,
      issuedBy: sampleAdmin.uid,
      issuedByName: sampleAdmin.displayName,
      note: "Salary advance for medical expense",
    });

    expect(advance.voucherNumber).toContain("ADV");
    expect(getCustomerBalance(customer.id)).toBe(5000);

    // Cashier attempts balance adjustment -> Refused
    await expect(
      adjustCustomerBalance({
        customerId: customer.id,
        shopId: "rightway",
        amount: 2000,
        direction: "CREDIT",
        reason: "Test adjustment",
        userId: sampleCashier.uid,
      })
    ).rejects.toThrow(/Only Super Admin can adjust or write off customer balances/i);

    // Cashier attempts modifying credit limit -> Refused
    await expect(
      updateCustomer(
        customer.id,
        {
          creditLimit: 60000,
        },
        sampleCashier.uid
      )
    ).rejects.toThrow(/Only Super Admin can modify credit limits/i);

    // Super Admin adjusts balance (write off 1,000) -> Success
    await adjustCustomerBalance({
      customerId: customer.id,
      shopId: "rightway",
      amount: 1000,
      direction: "CREDIT",
      reason: "Approved concession",
      userId: sampleAdmin.uid,
      isWriteOff: true,
    });

    expect(getCustomerBalance(customer.id)).toBe(4000);
  });

  it("C7: Customer balance equals sum of ledger entries after mixed sequence of actions", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Saman Kumara",
      phone: "0777788990",
      type: "REGULAR",
      creditLimit: 100000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    expect(getCustomerBalance(customer.id)).toBe(0);

    // 1. Credit sale: +12,000 (DEBIT)
    await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 12000,
          listPrice: 12000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 12000,
        },
      ],
      subtotal: 12000,
      discount: 0,
      taxAmount: 0,
      total: 12000,
      payments: [{ method: "CREDIT", amount: 12000 }],
    });
    expect(getCustomerBalance(customer.id)).toBe(12000);

    // 2. Cash advance: +5,000 (DEBIT)
    await issueCashAdvance({
      customerId: customer.id,
      shopId: "rightway",
      amount: 5000,
      issuedBy: sampleAdmin.uid,
      issuedByName: sampleAdmin.displayName,
    });
    expect(getCustomerBalance(customer.id)).toBe(17000);

    // 3. Payment received: -8,000 (CREDIT)
    await receiveCustomerPayment({
      customerId: customer.id,
      shopId: "rightway",
      amount: 8000,
      method: "CASH",
      receivedBy: sampleCashier.uid,
      receivedByName: sampleCashier.displayName,
    });
    expect(getCustomerBalance(customer.id)).toBe(9000);

    // 4. Admin debit adjustment (e.g. interest or correction): +500 (DEBIT)
    await adjustCustomerBalance({
      customerId: customer.id,
      shopId: "rightway",
      amount: 500,
      direction: "DEBIT",
      reason: "Correction debit",
      userId: sampleAdmin.uid,
    });
    expect(getCustomerBalance(customer.id)).toBe(9500);

    // 5. Admin write-off: -1,500 (CREDIT)
    await adjustCustomerBalance({
      customerId: customer.id,
      shopId: "rightway",
      amount: 1500,
      direction: "CREDIT",
      reason: "Write-off partial bad debt",
      userId: sampleAdmin.uid,
      isWriteOff: true,
    });
    expect(getCustomerBalance(customer.id)).toBe(8000);

    // Verify mathematical ledger invariant: Balance = sum(DEBIT) - sum(CREDIT)
    const ledger = getCustomerLedger(customer.id);
    let computedBalance = 0;
    for (const entry of ledger) {
      if (entry.direction === "DEBIT") computedBalance += entry.amount;
      if (entry.direction === "CREDIT") computedBalance -= entry.amount;
    }
    expect(computedBalance).toBe(8000);
    expect(getCustomerBalance(customer.id)).toBe(computedBalance);
  });

  it("C8: Reports show Credit (not collected) and Payments received on account separately; Outstanding credit matches ledger", async () => {
    const variant = getVariants()[0];
    const customer = await createCustomer({
      name: "Niroshan Dickwella",
      phone: "0778899001",
      type: "REGULAR",
      creditLimit: 50000,
      shopId: "rightway",
      createdBy: sampleCashier.uid,
    });

    // Credit sale today
    await completeSale({
      shopId: "rightway",
      cashierId: sampleCashier.uid,
      cashierName: sampleCashier.displayName,
      customerId: customer.id,
      items: [
        {
          variant,
          quantity: 1,
          unitPrice: 15000,
          listPrice: 15000,
          priceOverridden: false,
          discount: 0,
          lineTotal: 15000,
        },
      ],
      subtotal: 15000,
      discount: 0,
      taxAmount: 0,
      total: 15000,
      payments: [{ method: "CREDIT", amount: 15000 }],
    });

    // Customer payment today
    await receiveCustomerPayment({
      customerId: customer.id,
      shopId: "rightway",
      amount: 6000,
      method: "CASH",
      receivedBy: sampleCashier.uid,
      receivedByName: sampleCashier.displayName,
    });

    const daySales = getDailySalesData("rightway", Date.now(), sampleAdmin);

    // Credit not collected: 15,000
    expect(daySales.payments.credit).toBe(15000);
    // Payment received on account: 6,000
    expect(daySales.payments.paymentsReceivedOnAccount).toBe(6000);

    // Outstanding credit list
    const outstanding = getAllOutstandingCreditCustomers();
    const custOut = outstanding.find((o) => o.customer.id === customer.id);
    expect(custOut).toBeDefined();
    expect(custOut?.balance).toBe(9000);
    expect(custOut?.balance).toBe(getCustomerBalance(customer.id));
  });
});
