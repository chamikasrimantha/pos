// src/lib/__tests__/wp1-roles-users.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  completeSale,
  toggleUserActive,
  updateUserProfile,
  createUserProfile,
  getUsers,
} from "../firestore-service";
import { SEED_USERS } from "../seed-data";
import { ERROR_MESSAGES } from "@/types";

describe("WP1: Roles, Users & Access Control Guards", () => {
  beforeEach(() => {
    // Reset local store in testing environment if needed
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  it("R3: Seed users contain no active managers (only Super Admin and Cashiers)", () => {
    const activeManagers = SEED_USERS.filter((u) => u.role === "SHOP_MANAGER" && u.active && !u.hidden);
    expect(activeManagers.length).toBe(0);

    const activeCashiers = SEED_USERS.filter((u) => u.role === "CASHIER" && u.active && !u.hidden);
    expect(activeCashiers.length).toBe(2);

    const activeAdmins = SEED_USERS.filter((u) => u.role === "SUPER_ADMIN" && u.active && !u.hidden);
    expect(activeAdmins.length).toBe(1);
  });

  it("R3: getUsers(false) filters out hidden/archived managers from pickers & user lists", () => {
    const visibleUsers = getUsers(false);
    expect(visibleUsers.some((u) => u.hidden === true)).toBe(false);
    expect(visibleUsers.some((u) => u.uid === "manager_rightway")).toBe(false);
    expect(visibleUsers.some((u) => u.uid === "manager_mega")).toBe(false);
  });

  it("R6: completeSale refuses Super Admin at the data layer", async () => {
    await expect(
      completeSale({
        shopId: "rightway",
        cashierId: "admin_user_01",
        cashierName: "Senaka Fernando (Super Admin)",
        shiftId: "shift_test_01",
        items: [],
        subtotal: 1000,
        discount: 0,
        taxAmount: 0,
        total: 1000,
        payments: [{ method: "CASH", amount: 1000 }],
      })
    ).rejects.toThrow("The administrator account cannot make sales");
  });

  it("R7: Cannot disable the last active Super Admin", async () => {
    await expect(
      toggleUserActive("admin_user_01", false, "admin_user_02")
    ).rejects.toThrow(ERROR_MESSAGES.LAST_ADMIN);
  });

  it("R7: Cannot demote the last active Super Admin", async () => {
    await expect(
      updateUserProfile("admin_user_01", { role: "CASHIER" }, "admin_user_02")
    ).rejects.toThrow(ERROR_MESSAGES.LAST_ADMIN);
  });

  it("R7: Cannot disable or demote your own account", async () => {
    await expect(
      toggleUserActive("admin_user_01", false, "admin_user_01")
    ).rejects.toThrow("You cannot disable your own administrator account.");

    await expect(
      updateUserProfile("admin_user_01", { role: "CASHIER" }, "admin_user_01")
    ).rejects.toThrow("You cannot demote your own administrator account.");
  });

  it("R4: Creating a new user sets mustChangePassword: true and stores temporary password", async () => {
    const newUser = await createUserProfile({
      email: `test_cashier_${Date.now()}@shoes.pos`,
      displayName: "Test New Cashier",
      role: "CASHIER",
      allowedShopIds: ["rightway"],
      createdBy: "admin_user_01",
      password: "TemporaryPass123!",
      mustChangePassword: true,
    });

    expect(newUser.mustChangePassword).toBe(true);
    expect(newUser.password).toBe("TemporaryPass123!");
    expect(newUser.active).toBe(true);
  });
});

