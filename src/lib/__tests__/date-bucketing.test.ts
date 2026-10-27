import { describe, it, expect } from "vitest";
import {
  getColomboDateParts,
  getColomboDayRange,
  getColomboMonthRange,
  formatColomboDateKey,
  COLOMBO_OFFSET_MS,
} from "../date-utils";

describe("Date Bucketing — Asia/Colombo Timezone Boundaries", () => {
  it("correctly buckets a sale made at 23:50 Asia/Colombo to that calendar day", () => {
    // 2026-10-27 23:50:00 Colombo
    // Since Colombo is UTC+05:30:
    // 23:50 Colombo = 18:20 UTC on the SAME date (2026-10-27)
    const saleDateUtc = Date.UTC(2026, 9, 27, 18, 20, 0); // 9 = October
    const parts = getColomboDateParts(saleDateUtc);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(10);
    expect(parts.day).toBe(27);
    expect(parts.hour).toBe(23);
    expect(parts.minute).toBe(50);

    const { startOfDay, endOfDay, dateKey } = getColomboDayRange(saleDateUtc);
    expect(dateKey).toBe("2026-10-27");
    expect(saleDateUtc).toBeGreaterThanOrEqual(startOfDay);
    expect(saleDateUtc).toBeLessThanOrEqual(endOfDay);
  });

  it("correctly buckets a sale at 00:05 Asia/Colombo to the new day", () => {
    // 2026-10-28 00:05:00 Colombo = 2026-10-27 18:35:00 UTC
    const saleDateUtc = Date.UTC(2026, 9, 27, 18, 35, 0);
    const parts = getColomboDateParts(saleDateUtc);

    expect(parts.day).toBe(28);
    expect(parts.hour).toBe(0);
    expect(parts.minute).toBe(5);

    const { dateKey } = getColomboDayRange(saleDateUtc);
    expect(dateKey).toBe("2026-10-28");
  });

  it("generates correct month ranges for any year and month", () => {
    const range = getColomboMonthRange(2026, 2); // February 2026
    expect(range.daysInMonth).toBe(28);
    expect(range.monthKey).toBe("2026-02");

    // Start of Feb 1 Colombo in UTC = 2026-01-31 18:30 UTC
    const expectedStart = Date.UTC(2026, 0, 31, 18, 30, 0);
    expect(range.startOfMonth).toBe(expectedStart);
  });
});
