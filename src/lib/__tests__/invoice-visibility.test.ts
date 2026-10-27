import { describe, it, expect, beforeEach } from "vitest";
import { getInvoicesForUser } from "../firestore-service";
import { UserProfile } from "@/types";

describe("Feature 4 — Invoice Visibility & Access Control", () => {
  const cashierRW: UserProfile = {
    uid: "cashier_rightway",
    email: "cashier.rw@shoes.pos",
    displayName: "Nadeeka Silva",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const cashierMG: UserProfile = {
    uid: "cashier_mega",
    email: "cashier.mg@shoes.pos",
    displayName: "Dinesh Ranatunga",
    role: "CASHIER",
    allowedShopIds: ["mega"],
    active: true,
  };

  const managerRW: UserProfile = {
    uid: "manager_rightway",
    email: "manager.rw@shoes.pos",
    displayName: "Kasun Perera",
    role: "SHOP_MANAGER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const superAdmin: UserProfile = {
    uid: "admin_user_01",
    email: "admin@shoes.pos",
    displayName: "Senaka Fernando",
    role: "SUPER_ADMIN",
    allowedShopIds: ["rightway", "mega"],
    active: true,
  };

  it("D1: A cashier sees only their own invoices in the list and search; another cashier's invoice number returns no result", () => {
    // cashierRW queries invoices without filters
    const res = getInvoicesForUser(cashierRW);
    expect(res.invoices.length).toBeGreaterThan(0);
    expect(res.invoices.every((inv) => inv.cashierId === cashierRW.uid)).toBe(true);

    // Searching for another cashier's invoice (MG-INV-000051) returns 0 results
    const otherSearch = getInvoicesForUser(cashierRW, { search: "MG-INV-000051" });
    expect(otherSearch.invoices.length).toBe(0);

    // Searching for their own invoice (RW-INV-000101) returns the result
    const ownSearch = getInvoicesForUser(cashierRW, { search: "RW-INV-000101" });
    expect(ownSearch.invoices.length).toBe(1);
    expect(ownSearch.invoices[0].invoiceNumber).toBe("RW-INV-000101");
  });

  it("D2: A manager sees only invoices the manager issued, not cashiers' invoices", () => {
    const res = getInvoicesForUser(managerRW);
    expect(res.invoices.length).toBeGreaterThan(0);
    // Every invoice must have cashierId === managerRW.uid
    expect(res.invoices.every((inv) => inv.cashierId === managerRW.uid)).toBe(true);

    // Cashier RW's invoice is NOT visible to Manager RW
    const cashierInvSearch = getInvoicesForUser(managerRW, { search: "RW-INV-000101" });
    expect(cashierInvSearch.invoices.length).toBe(0);

    // Manager RW's own invoice is found
    const ownSearch = getInvoicesForUser(managerRW, { search: "RW-INV-000102" });
    expect(ownSearch.invoices.length).toBe(1);
  });

  it("D3: The Super Admin sees all invoices, and can filter by outlet and by person", () => {
    const allRes = getInvoicesForUser(superAdmin);
    // Contains invoices from multiple cashiers and outlets
    const cashierIds = new Set(allRes.invoices.map((i) => i.cashierId));
    expect(cashierIds.size).toBeGreaterThan(1);
    expect(cashierIds.has(cashierRW.uid)).toBe(true);
    expect(cashierIds.has(cashierMG.uid)).toBe(true);

    // Filter by outlet: Mega Shoes only
    const megaRes = getInvoicesForUser(superAdmin, { shopId: "mega" });
    expect(megaRes.invoices.length).toBeGreaterThan(0);
    expect(megaRes.invoices.every((i) => i.shopId === "mega")).toBe(true);

    // Filter by person: cashier_rightway only
    const personRes = getInvoicesForUser(superAdmin, { cashierId: "cashier_rightway" });
    expect(personRes.invoices.length).toBeGreaterThan(0);
    expect(personRes.invoices.every((i) => i.cashierId === "cashier_rightway")).toBe(true);
  });

  it("D4: Directly calling the data function with another user's filter as a cashier returns nothing", () => {
    // cashierRW attempts to pass cashierId of cashierMG
    const breachAttempt = getInvoicesForUser(cashierRW, { cashierId: cashierMG.uid });
    expect(breachAttempt.invoices.length).toBe(0);
    expect(breachAttempt.totalCount).toBe(0);

    // cashierRW attempts to pass cashierId of managerRW
    const breachAttempt2 = getInvoicesForUser(cashierRW, { cashierId: managerRW.uid });
    expect(breachAttempt2.invoices.length).toBe(0);
  });

  it("D5: Search by partial invoice number, customer phone, and amount each find the right invoice for allowed viewer", () => {
    // Partial invoice number "000101"
    const searchInv = getInvoicesForUser(superAdmin, { search: "000101" });
    expect(searchInv.invoices.length).toBe(1);
    expect(searchInv.invoices[0].invoiceNumber).toBe("RW-INV-000101");

    // Customer phone "0771234567"
    const searchPhone = getInvoicesForUser(superAdmin, { search: "0771234567" });
    expect(searchPhone.invoices.length).toBe(1);
    expect(searchPhone.invoices[0].customerName).toBe("Kamal Gunaratne");

    // Exact amount 24500
    const searchAmount = getInvoicesForUser(superAdmin, { search: "24500" });
    expect(searchAmount.invoices.length).toBe(1);
    expect(searchAmount.invoices[0].invoiceNumber).toBe("RW-INV-000102");
  });
});
