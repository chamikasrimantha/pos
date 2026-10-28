import { describe, it, expect, beforeEach } from "vitest";
import {
  getDailySalesData,
  getMonthDailySummary,
  getDayEndStatusData,
} from "../firestore-service";
import { UserProfile } from "@/types";

describe("Daily Sales & Day-End Status", () => {
  const superAdmin: UserProfile = {
    uid: "admin_user_01",
    email: "admin@shoes.pos",
    displayName: "Super Admin",
    role: "SUPER_ADMIN",
    allowedShopIds: ["shop_rightway", "shop_mega"],
    active: true,
  };

  const cashierRW: UserProfile = {
    uid: "cashier_rightway",
    email: "cashier.rw@shoes.pos",
    displayName: "Cashier RightWay",
    role: "CASHIER",
    allowedShopIds: ["shop_rightway"],
    active: true,
  };

  const cashierMG: UserProfile = {
    uid: "cashier_mega",
    email: "cashier.mg@shoes.pos",
    displayName: "Cashier Mega",
    role: "CASHIER",
    allowedShopIds: ["shop_mega"],
    active: true,
  };

  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("Test B1: getDailySalesData scopes sales for cashier to their own sales only", () => {
    // Current date timestamp
    const testTimestamp = Date.now();

    const adminData = getDailySalesData("ALL", testTimestamp, superAdmin);
    const cashierData = getDailySalesData("ALL", testTimestamp, cashierRW);

    expect(adminData.sales.length).toBeGreaterThan(0);
    // Cashier RW should only see sales where cashierId === cashier_rightway
    cashierData.sales.forEach((s) => {
      expect(s.cashierId).toBe("cashier_rightway");
    });
    expect(cashierData.sales.length).toBeLessThanOrEqual(adminData.sales.length);
  });

  it("Test B2: getMonthDailySummary returns accurate calendar buckets for past months (September 2026)", () => {
    const summary = getMonthDailySummary("ALL", 2026, 9, superAdmin);
    expect(summary.length).toBe(30); // September has 30 days
    // In our seed data, we added sales on 2026-09-15
    const day15 = summary.find((s) => s.day === 15);
    expect(day15).toBeDefined();
    expect(day15?.invoiceCount).toBeGreaterThan(0);
    expect(day15?.hasSales).toBe(true);
  });

  it("Test C4: getDayEndStatusData blocks non-Super Admins at the data layer", () => {
    const testTimestamp = new Date("2026-10-27T10:00:00+05:30").getTime();
    expect(() => {
      getDayEndStatusData("ALL", testTimestamp, cashierRW);
    }).toThrow();

    expect(() => {
      getDayEndStatusData("ALL", testTimestamp, cashierMG);
    }).toThrow();
  });

  it("Test C1: getDayEndStatusData calculates invoice counts, status breakdown, and shift reconciliation for Super Admin", () => {
    const testTimestamp = new Date("2026-10-27T10:00:00+05:30").getTime();
    const data = getDayEndStatusData("ALL", testTimestamp, superAdmin);

    expect(data.totalInvoices).toBeGreaterThanOrEqual(0);
    expect(data.completedInvoices + data.partiallyReturnedInvoices + data.fullyReturnedInvoices + data.cancelledInvoices)
      .toBe(data.totalInvoices);
    expect(data.shifts).toBeDefined();
    expect(typeof data.totalExpectedDrawerCash).toBe("number");
  });
});
