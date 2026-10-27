import { describe, it, expect } from "vitest";
import { computeExpectedDrawerCash, computeShiftVariance } from "../shift-math";

describe("Shift Math — Expected Drawer Cash & Variance Formula", () => {
  it("matches the exact specification formula with required test case", () => {
    // Case from specification:
    // Opening 10,000; Cash sales 46,000; Repair cash 4,000; Refunds 3,000; Removed 30,500
    // Expected drawer cash = 10,000 + 46,000 + 4,000 − 3,000 − 30,500 = 26,500
    const expectedCash = computeExpectedDrawerCash({
      openingFloat: 10000,
      cashSales: 46000,
      repairCashIn: 4000,
      cashRefunds: 3000,
      cashPayouts: 30500,
    });

    expect(expectedCash).toBe(26500);

    // Counted 26,300 -> variance -200
    const variance = computeShiftVariance(26300, expectedCash);
    expect(variance).toBe(-200);
  });

  it("handles empty or zero shift safely", () => {
    const expected = computeExpectedDrawerCash({
      openingFloat: 5000,
      cashSales: 0,
      repairCashIn: 0,
      cashRefunds: 0,
      cashPayouts: 0,
    });
    expect(expected).toBe(5000);
    expect(computeShiftVariance(5000, expected)).toBe(0);
  });

  it("handles optional or undefined properties without NaN", () => {
    const expected = computeExpectedDrawerCash({
      openingFloat: 15000,
      cashSales: 12000,
    });
    expect(expected).toBe(27000);
  });
});
