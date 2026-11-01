// src/lib/__tests__/permissions.test.ts
import { describe, it, expect } from "vitest";
import { can, isModuleVisible, PermissionKey } from "../permissions";
import { UserProfile } from "@/types";

describe("Permissions Matrix - Section 2.3 & WP1", () => {
  const superAdminUser: UserProfile = {
    uid: "admin_1",
    email: "admin@shoes.pos",
    displayName: "Admin",
    role: "SUPER_ADMIN",
    allowedShopIds: ["rightway", "mega"],
    active: true,
  };

  const cashierUser: UserProfile = {
    uid: "cashier_1",
    email: "cashier@shoes.pos",
    displayName: "Cashier",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const shopManagerUser: UserProfile = {
    uid: "manager_1",
    email: "manager@shoes.pos",
    displayName: "Manager",
    role: "SHOP_MANAGER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  describe("POS Counter & Sales", () => {
    it("Super Admin cannot make sales or access POS counter; Cashier and Manager can", () => {
      expect(can(superAdminUser, "pos.use_counter")).toBe(false);
      expect(can(cashierUser, "pos.use_counter")).toBe(true);
      expect(can(shopManagerUser, "pos.use_counter")).toBe(true);
    });

    it("Price override is allowed for Cashier and Manager; disallowed for Super Admin", () => {
      expect(can(superAdminUser, "pos.price.override")).toBe(false);
      expect(can(cashierUser, "pos.price.override")).toBe(true);
      expect(can(shopManagerUser, "pos.price.override")).toBe(true);
    });

    it("Credit sale is allowed for Cashier and Manager; disallowed for Super Admin", () => {
      expect(can(superAdminUser, "pos.credit.sell")).toBe(false);
      expect(can(cashierUser, "pos.credit.sell")).toBe(true);
      expect(can(shopManagerUser, "pos.credit.sell")).toBe(true);
    });
  });

  describe("Customers & Credit", () => {
    it("View and add customers is allowed for all roles", () => {
      expect(can(superAdminUser, "customers.view_and_add")).toBe(true);
      expect(can(cashierUser, "customers.view_and_add")).toBe(true);
      expect(can(shopManagerUser, "customers.view_and_add")).toBe(true);
    });

    it("Receive payment on account is allowed for all roles", () => {
      expect(can(superAdminUser, "customers.payment.receive")).toBe(true);
      expect(can(cashierUser, "customers.payment.receive")).toBe(true);
      expect(can(shopManagerUser, "customers.payment.receive")).toBe(true);
    });

    it("Manage customer limits, adjustments, and write-offs is Super Admin only", () => {
      expect(can(superAdminUser, "customers.manage")).toBe(true);
      expect(can(cashierUser, "customers.manage")).toBe(false);
      expect(can(shopManagerUser, "customers.manage")).toBe(false);
    });

    it("Record cash advance (credit as cash) is Super Admin only", () => {
      expect(can(superAdminUser, "customers.cash_advance")).toBe(true);
      expect(can(cashierUser, "customers.cash_advance")).toBe(false);
      expect(can(shopManagerUser, "customers.cash_advance")).toBe(false);
    });
  });

  describe("Products & Catalogue", () => {
    it("View and search catalogue is allowed for all roles", () => {
      expect(can(superAdminUser, "products.view")).toBe(true);
      expect(can(cashierUser, "products.view")).toBe(true);
      expect(can(shopManagerUser, "products.view")).toBe(true);
    });

    it("Quick add is allowed for all roles", () => {
      expect(can(superAdminUser, "products.quick_add")).toBe(true);
      expect(can(cashierUser, "products.quick_add")).toBe(true);
      expect(can(shopManagerUser, "products.quick_add")).toBe(true);
    });

    it("Full product editor is allowed for Super Admin and Manager; not Cashier", () => {
      expect(can(superAdminUser, "products.full_editor")).toBe(true);
      expect(can(cashierUser, "products.full_editor")).toBe(false);
      expect(can(shopManagerUser, "products.full_editor")).toBe(true);
    });

    it("Edit descriptive attributes is allowed for all roles", () => {
      expect(can(superAdminUser, "products.edit_attributes")).toBe(true);
      expect(can(cashierUser, "products.edit_attributes")).toBe(true);
      expect(can(shopManagerUser, "products.edit_attributes")).toBe(true);
    });

    it("Edit master selling price is allowed for Super Admin and Manager; not Cashier", () => {
      expect(can(superAdminUser, "products.edit_selling_price")).toBe(true);
      expect(can(cashierUser, "products.edit_selling_price")).toBe(false);
      expect(can(shopManagerUser, "products.edit_selling_price")).toBe(true);
    });

    it("Edit cost price is Super Admin only", () => {
      expect(can(superAdminUser, "products.edit_cost_price")).toBe(true);
      expect(can(cashierUser, "products.edit_cost_price")).toBe(false);
      expect(can(shopManagerUser, "products.edit_cost_price")).toBe(false);
    });

    it("Edit barcode/SKU of variant with stock is allowed for Super Admin and Manager; not Cashier", () => {
      expect(can(superAdminUser, "products.edit_barcode_stocked")).toBe(true);
      expect(can(cashierUser, "products.edit_barcode_stocked")).toBe(false);
      expect(can(shopManagerUser, "products.edit_barcode_stocked")).toBe(true);
    });

    it("Set barcode on new or unstocked variant is allowed for all roles", () => {
      expect(can(superAdminUser, "products.set_barcode_unstocked")).toBe(true);
      expect(can(cashierUser, "products.set_barcode_unstocked")).toBe(true);
      expect(can(shopManagerUser, "products.set_barcode_unstocked")).toBe(true);
    });

    it("Deactivate/reactivate is allowed for Super Admin and Manager; not Cashier", () => {
      expect(can(superAdminUser, "products.deactivate")).toBe(true);
      expect(can(cashierUser, "products.deactivate")).toBe(false);
      expect(can(shopManagerUser, "products.deactivate")).toBe(true);
    });

    it("Add brand, colour, size, category inline is allowed for all roles", () => {
      expect(can(superAdminUser, "products.add_master_values")).toBe(true);
      expect(can(cashierUser, "products.add_master_values")).toBe(true);
      expect(can(shopManagerUser, "products.add_master_values")).toBe(true);
    });

    it("Manage master values (rename, merge, deactivate) is Super Admin only", () => {
      expect(can(superAdminUser, "products.manage_master_values")).toBe(true);
      expect(can(cashierUser, "products.manage_master_values")).toBe(false);
      expect(can(shopManagerUser, "products.manage_master_values")).toBe(false);
    });

    it("Print and edit labels is allowed for Cashier and Manager; hidden from Super Admin", () => {
      expect(can(superAdminUser, "products.print_labels")).toBe(false);
      expect(can(cashierUser, "products.print_labels")).toBe(true);
      expect(can(shopManagerUser, "products.print_labels")).toBe(true);
    });
  });

  describe("Inventory & Stock", () => {
    it("Stock check (quantities only) is allowed for all roles", () => {
      expect(can(superAdminUser, "inventory.stock_check")).toBe(true);
      expect(can(cashierUser, "inventory.stock_check")).toBe(true);
      expect(can(shopManagerUser, "inventory.stock_check")).toBe(true);
    });

    it("Cost valuation and stock adjustment is Super Admin only", () => {
      expect(can(superAdminUser, "inventory.cost_valuation_adjust")).toBe(true);
      expect(can(cashierUser, "inventory.cost_valuation_adjust")).toBe(false);
      expect(can(shopManagerUser, "inventory.cost_valuation_adjust")).toBe(false);
    });

    it("Movement history view is allowed for Super Admin and Shop Manager; not Cashier", () => {
      expect(can(superAdminUser, "inventory.movements_own_branch")).toBe(true);
      expect(can(cashierUser, "inventory.movements_own_branch")).toBe(false);
      expect(can(shopManagerUser, "inventory.movements_own_branch")).toBe(true);
    });
  });

  describe("Branch Transfers", () => {
    it("Quick transfer by scan is allowed for all roles", () => {
      expect(can(superAdminUser, "transfers.quick")).toBe(true);
      expect(can(cashierUser, "transfers.quick")).toBe(true);
      expect(can(shopManagerUser, "transfers.quick")).toBe(true);
    });

    it("Formal transfer dispatch & receive is allowed for all roles", () => {
      expect(can(superAdminUser, "transfers.formal_dispatch_receive")).toBe(true);
      expect(can(cashierUser, "transfers.formal_dispatch_receive")).toBe(true);
      expect(can(shopManagerUser, "transfers.formal_dispatch_receive")).toBe(true);
    });
  });

  describe("Purchasing & Suppliers", () => {
    it("Create cash purchase is allowed for all roles", () => {
      expect(can(superAdminUser, "purchasing.cash_bill.create")).toBe(true);
      expect(can(cashierUser, "purchasing.cash_bill.create")).toBe(true);
      expect(can(shopManagerUser, "purchasing.cash_bill.create")).toBe(true);
    });

    it("Issue cheque for purchase is allowed for all roles", () => {
      expect(can(superAdminUser, "purchasing.cheque.issue")).toBe(true);
      expect(can(cashierUser, "purchasing.cheque.issue")).toBe(true);
      expect(can(shopManagerUser, "purchasing.cheque.issue")).toBe(true);
    });

    it("Credit, bank transfer, and part-paid purchases are Super Admin only", () => {
      expect(can(superAdminUser, "purchasing.credit_or_bank.create")).toBe(true);
      expect(can(cashierUser, "purchasing.credit_or_bank.create")).toBe(false);
      expect(can(shopManagerUser, "purchasing.credit_or_bank.create")).toBe(false);
    });

    it("Add new supplier and view basic supplier info is allowed for all roles", () => {
      expect(can(superAdminUser, "purchasing.suppliers.add")).toBe(true);
      expect(can(cashierUser, "purchasing.suppliers.add")).toBe(true);
      expect(can(shopManagerUser, "purchasing.suppliers.add")).toBe(true);

      expect(can(superAdminUser, "purchasing.suppliers.view_basic")).toBe(true);
      expect(can(cashierUser, "purchasing.suppliers.view_basic")).toBe(true);
      expect(can(shopManagerUser, "purchasing.suppliers.view_basic")).toBe(true);
    });

    it("Supplier ledger, balance, and cheque status management is Super Admin only", () => {
      expect(can(superAdminUser, "purchasing.suppliers.manage_ledger_cheques")).toBe(true);
      expect(can(cashierUser, "purchasing.suppliers.manage_ledger_cheques")).toBe(false);
      expect(can(shopManagerUser, "purchasing.suppliers.manage_ledger_cheques")).toBe(false);
    });

    it("View all purchase bills is Super Admin only; view own bills is allowed for all", () => {
      expect(can(superAdminUser, "purchasing.bills.view_all")).toBe(true);
      expect(can(cashierUser, "purchasing.bills.view_all")).toBe(false);
      expect(can(shopManagerUser, "purchasing.bills.view_all")).toBe(false);

      expect(can(superAdminUser, "purchasing.bills.view_own")).toBe(true);
      expect(can(cashierUser, "purchasing.bills.view_own")).toBe(true);
      expect(can(shopManagerUser, "purchasing.bills.view_own")).toBe(true);
    });
  });

  describe("Repairs Desk", () => {
    it("Receive, update, deliver repairs is allowed for all roles", () => {
      expect(can(superAdminUser, "repairs.receive_update_deliver")).toBe(true);
      expect(can(cashierUser, "repairs.receive_update_deliver")).toBe(true);
      expect(can(shopManagerUser, "repairs.receive_update_deliver")).toBe(true);
    });

    it("Edit price after intake or cancel repair is Super Admin only", () => {
      expect(can(superAdminUser, "repairs.edit_price_or_cancel")).toBe(true);
      expect(can(cashierUser, "repairs.edit_price_or_cancel")).toBe(false);
      expect(can(shopManagerUser, "repairs.edit_price_or_cancel")).toBe(false);
    });
  });

  describe("Employees, Users & Admin Oversight", () => {
    it("Employees & Payroll management is Super Admin only", () => {
      expect(can(superAdminUser, "employees.manage")).toBe(true);
      expect(can(cashierUser, "employees.manage")).toBe(false);
      expect(can(shopManagerUser, "employees.manage")).toBe(false);
    });

    it("User management is Super Admin only", () => {
      expect(can(superAdminUser, "users.manage")).toBe(true);
      expect(can(cashierUser, "users.manage")).toBe(false);
      expect(can(shopManagerUser, "users.manage")).toBe(false);
    });

    it("Review Inbox is Super Admin only", () => {
      expect(can(superAdminUser, "review_inbox.view")).toBe(true);
      expect(can(cashierUser, "review_inbox.view")).toBe(false);
      expect(can(shopManagerUser, "review_inbox.view")).toBe(false);
    });
  });

  describe("Sidebar & Module Visibility - Section 2.2", () => {
    it("POS module is hidden for Super Admin, visible for Cashier and Manager", () => {
      expect(isModuleVisible("SUPER_ADMIN", "pos")).toBe(false);
      expect(isModuleVisible("CASHIER", "pos")).toBe(true);
      expect(isModuleVisible("SHOP_MANAGER", "pos")).toBe(true);
    });

    it("Shifts module is removed for everyone", () => {
      expect(isModuleVisible("SUPER_ADMIN", "shifts")).toBe(false);
      expect(isModuleVisible("CASHIER", "shifts")).toBe(false);
      expect(isModuleVisible("SHOP_MANAGER", "shifts")).toBe(false);
    });

    it("Cashier cannot see Suppliers, Employees, Review Inbox, or Admin", () => {
      expect(isModuleVisible("CASHIER", "suppliers")).toBe(false);
      expect(isModuleVisible("CASHIER", "employees")).toBe(false);
      expect(isModuleVisible("CASHIER", "reviewInbox")).toBe(false);
      expect(isModuleVisible("CASHIER", "admin")).toBe(false);
    });

    it("Super Admin can see Suppliers, Employees, Review Inbox, and Admin", () => {
      expect(isModuleVisible("SUPER_ADMIN", "suppliers")).toBe(true);
      expect(isModuleVisible("SUPER_ADMIN", "employees")).toBe(true);
      expect(isModuleVisible("SUPER_ADMIN", "reviewInbox")).toBe(true);
      expect(isModuleVisible("SUPER_ADMIN", "admin")).toBe(true);
    });
  });
});
