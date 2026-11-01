import { describe, it, expect } from "vitest";
import { computeDailyCashSummary } from "../daily-cash-math";
import { Sale, CustomerReturn, ShoeRepairOrder } from "@/types";

describe("Daily Cash Summary — Pure Transaction Reconciliation", () => {
  const mockSales: Sale[] = [
    {
      id: "sale_1",
      invoiceNumber: "RW-INV-0001",
      shopId: "rightway",
      cashierId: "cashier_1",
      cashierNameCache: "Cashier RightWay",
      subtotal: 5000,
      discount: 0,
      taxAmount: 0,
      total: 5000,
      payments: [{ method: "CASH", amount: 5000 }],
      status: "COMPLETED",
      createdAt: Date.now(),
      saleDate: Date.now(),
      returnedAmount: 0,
      returnStatus: "NONE",
    },
    {
      id: "sale_2",
      invoiceNumber: "RW-INV-0002",
      shopId: "rightway",
      cashierId: "cashier_1",
      cashierNameCache: "Cashier RightWay",
      subtotal: 10000,
      discount: 1000,
      taxAmount: 0,
      total: 9000,
      payments: [
        { method: "CASH", amount: 4000 },
        { method: "CARD", amount: 5000 },
      ],
      status: "COMPLETED",
      createdAt: Date.now(),
      saleDate: Date.now(),
      returnedAmount: 0,
      returnStatus: "NONE",
    },
    {
      id: "sale_3",
      invoiceNumber: "MG-INV-0001",
      shopId: "megashoes",
      cashierId: "cashier_2",
      cashierNameCache: "Cashier Mega",
      subtotal: 7500,
      discount: 0,
      taxAmount: 0,
      total: 7500,
      payments: [{ method: "CASH", amount: 7500 }],
      status: "COMPLETED",
      createdAt: Date.now(),
      saleDate: Date.now(),
      returnedAmount: 0,
      returnStatus: "NONE",
    },
    {
      id: "sale_cancelled",
      invoiceNumber: "RW-INV-0003",
      shopId: "rightway",
      cashierId: "cashier_1",
      cashierNameCache: "Cashier RightWay",
      subtotal: 3000,
      discount: 0,
      taxAmount: 0,
      total: 3000,
      payments: [{ method: "CASH", amount: 3000 }],
      status: "CANCELLED", // Should NOT be counted
      createdAt: Date.now(),
      saleDate: Date.now(),
      returnedAmount: 0,
      returnStatus: "NONE",
    },
  ];

  const mockReturns: CustomerReturn[] = [
    {
      id: "ret_1",
      returnNumber: "RW-RET-0001",
      shopId: "rightway",
      originalSaleId: "sale_1",
      originalInvoiceNumber: "RW-INV-0001",
      cashierId: "cashier_1",
      type: "RETURN_REFUND",
      items: [],
      subtotalRefund: 2000,
      netRefundAmount: 2000,
      refundMethod: "CASH",
      createdAt: Date.now(),
    },
    {
      id: "ret_card",
      returnNumber: "RW-RET-0002",
      shopId: "rightway",
      originalSaleId: "sale_2",
      originalInvoiceNumber: "RW-INV-0002",
      cashierId: "cashier_1",
      type: "RETURN_REFUND",
      items: [],
      subtotalRefund: 3000,
      netRefundAmount: 3000,
      refundMethod: "ORIGINAL_CARD", // Should NOT be in cash refunds
      createdAt: Date.now(),
    },
  ];

  const mockRepairs: ShoeRepairOrder[] = [
    {
      id: "rep_1",
      repairNumber: "RW-REP-0001",
      shopId: "rightway",
      intakeCashierId: "cashier_1",
      customerName: "Customer A",
      customerPhone: "0771234567",
      shoeBrand: "Apex",
      shoeModel: "Oxford",
      shoeSize: "42",
      shoeColor: "Black",
      isStorePurchased: true,
      issueDescription: "Sole repair",
      estimatedCost: 2500,
      advancePaid: 1000,
      advancePaymentMethod: "CASH",
      finalCost: 2500,
      balanceDue: 1500,
      status: "RECEIVED",
      receivedAt: Date.now(),
      promisedDate: Date.now() + 86400000,
      statusHistory: [],
    },
    {
      id: "rep_2",
      repairNumber: "RW-REP-0002",
      shopId: "rightway",
      intakeCashierId: "cashier_1",
      deliveryCashierId: "cashier_1",
      customerName: "Customer B",
      customerPhone: "0777654321",
      shoeBrand: "Apex",
      shoeModel: "Derby",
      shoeSize: "41",
      shoeColor: "Brown",
      isStorePurchased: false,
      issueDescription: "Heel repair",
      estimatedCost: 3000,
      advancePaid: 1000,
      advancePaymentMethod: "CARD",
      finalCost: 3000,
      balanceDue: 0,
      status: "DELIVERED",
      receivedAt: Date.now() - 86400000 * 3, // Received 3 days ago
      deliveredAt: Date.now(), // Delivered TODAY in cash
      deliveryPaymentMethod: "CASH",
      promisedDate: Date.now(),
      statusHistory: [],
    },
  ];

  it("calculates exact cash sales, cash refunds, repair cash and net cash movement for RightWay (Rs. 0.00 variance)", () => {
    const summary = computeDailyCashSummary({
      shopId: "rightway",
      sales: mockSales,
      returns: mockReturns,
      repairs: mockRepairs,
    });

    // Cash sales for rightway:
    // sale_1: 5000 CASH
    // sale_2: 4000 CASH
    // sale_cancelled: 0
    // Total gross cash sales = 9,000
    expect(summary.cashSales).toBe(9000);
    expect(summary.salesCount).toBe(2);

    // Cash refunds for rightway:
    // ret_1: 2000 CASH
    // ret_card: 0 (not cash)
    expect(summary.cashRefunds).toBe(2000);
    expect(summary.refundsCount).toBe(1);

    // Repair cash collected for rightway:
    // rep_1: advance 1000 CASH today
    // rep_2: delivery 2000 CASH today (final 3000 - advance 1000)
    expect(summary.repairCashCollected).toBe(3000);
    expect(summary.repairsCount).toBe(2);

    // Inflow = 9000 + 3000 = 12,000
    expect(summary.totalCashIn).toBe(12000);

    // Outflow = 2000
    expect(summary.totalCashOut).toBe(2000);

    // Net cash movement = 12000 - 2000 = 10,000
    expect(summary.netCashMovement).toBe(10000);
  });

  it("calculates all shops combined correctly", () => {
    const summary = computeDailyCashSummary({
      shopId: "ALL",
      sales: mockSales,
      returns: mockReturns,
      repairs: mockRepairs,
    });

    // RightWay cash sales: 9,000 + MegaShoes cash sales: 7,500 = 16,500
    expect(summary.cashSales).toBe(16500);
    expect(summary.salesCount).toBe(3);
    expect(summary.cashRefunds).toBe(2000);
    expect(summary.repairCashCollected).toBe(3000);
    expect(summary.totalCashIn).toBe(19500);
    expect(summary.netCashMovement).toBe(17500);
  });

  it("filters correctly by single cashier", () => {
    const summary = computeDailyCashSummary({
      shopId: "megashoes",
      cashierId: "cashier_2",
      sales: mockSales,
      returns: mockReturns,
      repairs: mockRepairs,
    });

    expect(summary.cashSales).toBe(7500);
    expect(summary.salesCount).toBe(1);
    expect(summary.cashRefunds).toBe(0);
    expect(summary.repairCashCollected).toBe(0);
    expect(summary.netCashMovement).toBe(7500);
  });
});
