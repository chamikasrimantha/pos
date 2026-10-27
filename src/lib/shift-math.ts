// src/lib/shift-math.ts
// Pure calculations for cashier shift cash drawer accountability
// Formula: Expected drawer cash = Opening float + Cash sales + Repair cash collected − Cash refunds − Cash removed from the drawer

export interface DrawerCashBreakdown {
  openingFloat: number;
  cashSales: number;
  repairCashIn?: number;
  cashRefunds?: number;
  cashPayouts?: number; // Cash removed from the drawer (paid-outs, safe drops)
}

/**
 * Computes expected drawer cash using the standardized formula.
 * Expected drawer cash = Opening float + Cash sales + Repair cash collected − Cash refunds − Cash removed from the drawer
 */
export function computeExpectedDrawerCash(breakdown: DrawerCashBreakdown): number {
  const openingFloat = Number(breakdown.openingFloat) || 0;
  const cashSales = Number(breakdown.cashSales) || 0;
  const repairCashIn = Number(breakdown.repairCashIn) || 0;
  const cashRefunds = Number(breakdown.cashRefunds) || 0;
  const cashPayouts = Number(breakdown.cashPayouts) || 0;

  return openingFloat + cashSales + repairCashIn - cashRefunds - cashPayouts;
}

/**
 * Computes the shift closing cash variance.
 * Variance = Counted cash − Expected drawer cash
 */
export function computeShiftVariance(countedCash: number, expectedCash: number): number {
  return Number(countedCash) - Number(expectedCash);
}
