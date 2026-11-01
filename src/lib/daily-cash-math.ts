// src/lib/daily-cash-math.ts
// Pure calculations for Daily Cash Summary derived directly from completed transactions
// Section 3.2: Gross cash sales + Repair cash collected + Customer payments - Cash refunds - Cash purchases - Cash advances

import { DailyCashSummary, Sale, CustomerReturn, ShoeRepairOrder } from "@/types";
import { getColomboDateParts, getColomboDayRange } from "./date-utils";

export interface CalculateDailyCashInput {
  shopId?: string;
  cashierId?: string;
  cashierName?: string;
  timestamp?: number;
  sales: Sale[];
  returns: CustomerReturn[];
  repairs: ShoeRepairOrder[];
  customerPayments?: { amount: number; paymentMethod: string; cashierId?: string; shopId?: string; createdAt: number }[];
  purchases?: { cashPaid: number; cashierId?: string; shopId?: string; createdAt: number }[];
  cashAdvances?: { amount: number; cashierId?: string; shopId?: string; createdAt: number }[];
}

export function computeDailyCashSummary(input: CalculateDailyCashInput): DailyCashSummary {
  const targetTs = input.timestamp || Date.now();
  const { startOfDay, endOfDay, dateKey } = getColomboDayRange(targetTs);
  const parts = getColomboDateParts(targetTs);
  const periodLabel = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

  const shopMatches = (sId?: string) => !input.shopId || input.shopId === "ALL" || sId === input.shopId;
  const cashierMatches = (cId?: string) => !input.cashierId || cId === input.cashierId;

  // 1. Gross Cash Sales: cash tendered minus change given across all sales where payment includes CASH
  let cashSales = 0;
  let salesCount = 0;
  for (const sale of input.sales) {
    if (sale.status === "CANCELLED") continue;
    if (sale.saleDate < startOfDay || sale.saleDate > endOfDay) continue;
    if (!shopMatches(sale.shopId)) continue;
    if (!cashierMatches(sale.cashierId)) continue;

    let saleCash = 0;
    if (sale.payments && sale.payments.length > 0) {
      for (const p of sale.payments) {
        if (p.method === "CASH") {
          saleCash += Number(p.amount) || 0;
        }
      }
    }
    if (saleCash > 0) {
      cashSales += saleCash;
      salesCount++;
    }
  }

  // 2. Cash Refunds: sum of cash returned to customers on returns processed today
  let cashRefunds = 0;
  let refundsCount = 0;
  for (const ret of input.returns) {
    if (ret.createdAt < startOfDay || ret.createdAt > endOfDay) continue;
    if (!shopMatches(ret.shopId)) continue;
    if (!cashierMatches(ret.cashierId)) continue;

    if (ret.refundMethod === "CASH" && ret.netRefundAmount > 0) {
      cashRefunds += Number(ret.netRefundAmount) || 0;
      refundsCount++;
    }
  }

  // 3. Repair Cash Collected: advance cash + delivery cash collected today
  let repairCashCollected = 0;
  let repairsCount = 0;
  for (const repair of input.repairs) {
    if (!shopMatches(repair.shopId)) continue;

    let orderCounted = false;
    // Intake advance collected today
    if (
      repair.receivedAt >= startOfDay &&
      repair.receivedAt <= endOfDay &&
      repair.advancePaid > 0 &&
      repair.advancePaymentMethod === "CASH" &&
      cashierMatches(repair.intakeCashierId)
    ) {
      repairCashCollected += Number(repair.advancePaid) || 0;
      orderCounted = true;
    }

    // Delivery final collected today
    if (
      repair.deliveredAt &&
      repair.deliveredAt >= startOfDay &&
      repair.deliveredAt <= endOfDay &&
      repair.deliveryPaymentMethod === "CASH" &&
      cashierMatches(repair.deliveryCashierId || undefined)
    ) {
      const balanceSettled = Math.max(0, (repair.finalCost || 0) - (repair.advancePaid || 0));
      if (balanceSettled > 0) {
        repairCashCollected += balanceSettled;
        orderCounted = true;
      }
    }

    if (orderCounted) {
      repairsCount++;
    }
  }

  // 4. Customer payments on account (WP5)
  let cashReceivedOnAccount = 0;
  if (input.customerPayments) {
    for (const cp of input.customerPayments) {
      if (cp.createdAt >= startOfDay && cp.createdAt <= endOfDay && cp.paymentMethod === "CASH") {
        if (shopMatches(cp.shopId) && cashierMatches(cp.cashierId)) {
          cashReceivedOnAccount += Number(cp.amount) || 0;
        }
      }
    }
  }

  // 5. Cash paid for purchases (WP7)
  let cashPaidForPurchases = 0;
  let purchasesCount = 0;
  if (input.purchases) {
    for (const pur of input.purchases) {
      if (pur.createdAt >= startOfDay && pur.createdAt <= endOfDay && pur.cashPaid > 0) {
        if (shopMatches(pur.shopId) && cashierMatches(pur.cashierId)) {
          cashPaidForPurchases += Number(pur.cashPaid) || 0;
          purchasesCount++;
        }
      }
    }
  }

  // 6. Cash advances given (WP5/WP9)
  let cashAdvancesGiven = 0;
  if (input.cashAdvances) {
    for (const ca of input.cashAdvances) {
      if (ca.createdAt >= startOfDay && ca.createdAt <= endOfDay && ca.amount > 0) {
        if (shopMatches(ca.shopId) && cashierMatches(ca.cashierId)) {
          cashAdvancesGiven += Number(ca.amount) || 0;
        }
      }
    }
  }

  // Inflow, Outflow & Net Movement
  const totalCashIn = cashSales + cashReceivedOnAccount + repairCashCollected;
  const totalCashOut = cashRefunds + cashPaidForPurchases + cashAdvancesGiven;
  const netCashMovement = totalCashIn - totalCashOut;

  return {
    shopId: input.shopId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    dateKey,
    periodLabel,
    cashSales,
    cashReceivedOnAccount,
    repairCashCollected,
    totalCashIn,
    cashRefunds,
    cashPaidForPurchases,
    cashAdvancesGiven,
    totalCashOut,
    netCashMovement,
    salesCount,
    refundsCount,
    repairsCount,
    purchasesCount,
  };
}
