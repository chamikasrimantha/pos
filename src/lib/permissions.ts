// src/lib/permissions.ts
// Centralized permissions and role-based access control engine for Change Request 02
import React from "react";
import { UserRole, UserProfile } from "@/types";

export type PermissionKey =
  // POS
  | "pos.use_counter"
  | "pos.price.override"
  | "pos.credit.sell"
  | "pos.access"
  | "pos.sale.create"
  | "pos.discount.apply"
  | "pos.sale.cancel"
  | "pos.invoice.reprint"
  | "pos.history.view"
  // Customers
  | "customers.view_and_add"
  | "customers.payment.receive"
  | "customers.manage"
  | "customers.cash_advance"
  // Products
  | "products.view"
  | "products.quick_add"
  | "products.full_editor"
  | "products.edit_attributes"
  | "products.edit_selling_price"
  | "products.edit_cost_price"
  | "products.edit_barcode_stocked"
  | "products.set_barcode_unstocked"
  | "products.deactivate"
  | "products.add_master_values"
  | "products.manage_master_values"
  | "products.print_labels"
  | "product.create"
  | "product.edit"
  | "product.price.edit"
  | "product.barcode.print"
  // Inventory
  | "inventory.stock_check"
  | "inventory.cost_valuation_adjust"
  | "inventory.movements_own_branch"
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.count"
  | "inventory.cost.view"
  // Transfers
  | "transfers.quick"
  | "transfers.formal_dispatch_receive"
  | "transfer.request"
  | "transfer.approve"
  | "transfer.dispatch"
  | "transfer.receive"
  | "transfer.cancel"
  // Purchasing
  | "purchasing.cash_bill.create"
  | "purchasing.cheque.issue"
  | "purchasing.credit_or_bank.create"
  | "purchasing.suppliers.add"
  | "purchasing.suppliers.view_basic"
  | "purchasing.suppliers.manage_ledger_cheques"
  | "purchasing.bills.view_all"
  | "purchasing.bills.view_own"
  | "purchase.view"
  | "purchase.inward.view"
  | "purchase.create"
  | "purchase.cancel"
  // Repairs
  | "repairs.receive_update_deliver"
  | "repairs.edit_price_or_cancel"
  | "repair.receive"
  | "repair.update"
  | "repair.collect"
  | "repair.cancel"
  | "repair.price.edit"
  // Employees & Payroll
  | "employees.manage"
  // Users
  | "users.manage"
  | "user.manage"
  // Reports, Inbox, Settings, Audit
  | "reports.view_all"
  | "reports.view_own"
  | "reports.view.outlet"
  | "reports.view.all"
  | "reports.financial.view"
  | "review_inbox.view"
  | "settings.manage"
  | "audit.view"
  // Returns
  | "return.create"
  | "return.approve"
  | "return.cash_refund"
  | "return.override_window";

export interface PermissionContext {
  shopId?: string;
  hasStockOrSales?: boolean;
  isOwnBranch?: boolean;
  isOwnBill?: boolean;
}

// Static Role Permission Matrix derived strictly from Section 2.3 Action Matrix
export const ROLE_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  SUPER_ADMIN: {
    // POS: Super Admin has NO POS counter, NO price overrides at counter, NO credit sales
    "pos.use_counter": false,
    "pos.price.override": false,
    "pos.credit.sell": false,
    "pos.access": false,
    "pos.sale.create": false,
    "pos.discount.apply": false,
    "pos.sale.cancel": true,
    "pos.invoice.reprint": true,
    "pos.history.view": true,

    // Customers
    "customers.view_and_add": true,
    "customers.payment.receive": true,
    "customers.manage": true,
    "customers.cash_advance": true,

    // Products
    "products.view": true,
    "products.quick_add": true,
    "products.full_editor": true,
    "products.edit_attributes": true,
    "products.edit_selling_price": true,
    "products.edit_cost_price": true,
    "products.edit_barcode_stocked": true,
    "products.set_barcode_unstocked": true,
    "products.deactivate": true,
    "products.add_master_values": true,
    "products.manage_master_values": true,
    "products.print_labels": false, // Label printing hidden from Super Admin
    "product.create": true,
    "product.edit": true,
    "product.price.edit": true,
    "product.barcode.print": false,

    // Inventory
    "inventory.stock_check": true,
    "inventory.cost_valuation_adjust": true,
    "inventory.movements_own_branch": true,
    "inventory.view": true,
    "inventory.adjust": true,
    "inventory.count": true,
    "inventory.cost.view": true,

    // Transfers
    "transfers.quick": true,
    "transfers.formal_dispatch_receive": true,
    "transfer.request": true,
    "transfer.approve": true,
    "transfer.dispatch": true,
    "transfer.receive": true,
    "transfer.cancel": true,

    // Purchasing
    "purchasing.cash_bill.create": true,
    "purchasing.cheque.issue": true,
    "purchasing.credit_or_bank.create": true,
    "purchasing.suppliers.add": true,
    "purchasing.suppliers.view_basic": true,
    "purchasing.suppliers.manage_ledger_cheques": true,
    "purchasing.bills.view_all": true,
    "purchasing.bills.view_own": true,
    "purchase.view": true,
    "purchase.inward.view": true,
    "purchase.create": true,
    "purchase.cancel": true,

    // Repairs
    "repairs.receive_update_deliver": true,
    "repairs.edit_price_or_cancel": true,
    "repair.receive": true,
    "repair.update": true,
    "repair.collect": true,
    "repair.cancel": true,
    "repair.price.edit": true,

    // Employees & Payroll
    "employees.manage": true,

    // Users
    "users.manage": true,
    "user.manage": true,

    // Reports, Inbox, Settings, Audit
    "reports.view_all": true,
    "reports.view_own": true,
    "reports.view.outlet": true,
    "reports.view.all": true,
    "reports.financial.view": true,
    "review_inbox.view": true,
    "settings.manage": true,
    "audit.view": true,

    // Returns
    "return.create": true,
    "return.approve": true,
    "return.cash_refund": true,
    "return.override_window": true,
  },

  SHOP_MANAGER: {
    // POS
    "pos.use_counter": true,
    "pos.price.override": true,
    "pos.credit.sell": true,
    "pos.access": true,
    "pos.sale.create": true,
    "pos.discount.apply": true,
    "pos.sale.cancel": true,
    "pos.invoice.reprint": true,
    "pos.history.view": true,

    // Customers
    "customers.view_and_add": true,
    "customers.payment.receive": true,
    "customers.manage": false,
    "customers.cash_advance": false,

    // Products
    "products.view": true,
    "products.quick_add": true,
    "products.full_editor": true,
    "products.edit_attributes": true,
    "products.edit_selling_price": true,
    "products.edit_cost_price": false,
    "products.edit_barcode_stocked": true,
    "products.set_barcode_unstocked": true,
    "products.deactivate": true,
    "products.add_master_values": true,
    "products.manage_master_values": false,
    "products.print_labels": true,
    "product.create": true,
    "product.edit": true,
    "product.price.edit": true,
    "product.barcode.print": true,

    // Inventory
    "inventory.stock_check": true,
    "inventory.cost_valuation_adjust": false,
    "inventory.movements_own_branch": true,
    "inventory.view": true,
    "inventory.adjust": false,
    "inventory.count": true,
    "inventory.cost.view": false,

    // Transfers
    "transfers.quick": true,
    "transfers.formal_dispatch_receive": true,
    "transfer.request": true,
    "transfer.approve": true,
    "transfer.dispatch": true,
    "transfer.receive": true,
    "transfer.cancel": true,

    // Purchasing
    "purchasing.cash_bill.create": true,
    "purchasing.cheque.issue": true,
    "purchasing.credit_or_bank.create": false,
    "purchasing.suppliers.add": true,
    "purchasing.suppliers.view_basic": true,
    "purchasing.suppliers.manage_ledger_cheques": false,
    "purchasing.bills.view_all": false,
    "purchasing.bills.view_own": true,
    "purchase.view": false,
    "purchase.inward.view": true,
    "purchase.create": true,
    "purchase.cancel": false,

    // Repairs
    "repairs.receive_update_deliver": true,
    "repairs.edit_price_or_cancel": false,
    "repair.receive": true,
    "repair.update": true,
    "repair.collect": true,
    "repair.cancel": false,
    "repair.price.edit": false,

    // Employees & Payroll
    "employees.manage": false,

    // Users
    "users.manage": false,
    "user.manage": false,

    // Reports, Inbox, Settings, Audit
    "reports.view_all": false,
    "reports.view_own": true,
    "reports.view.outlet": true,
    "reports.view.all": false,
    "reports.financial.view": false,
    "review_inbox.view": false,
    "settings.manage": false,
    "audit.view": false,

    // Returns
    "return.create": true,
    "return.approve": true,
    "return.cash_refund": true,
    "return.override_window": false,
  },

  CASHIER: {
    // POS
    "pos.use_counter": true,
    "pos.price.override": true,
    "pos.credit.sell": true,
    "pos.access": true,
    "pos.sale.create": true,
    "pos.discount.apply": false,
    "pos.sale.cancel": false,
    "pos.invoice.reprint": true,
    "pos.history.view": false,

    // Customers
    "customers.view_and_add": true,
    "customers.payment.receive": true,
    "customers.manage": false,
    "customers.cash_advance": false,

    // Products
    "products.view": true,
    "products.quick_add": true,
    "products.full_editor": false,
    "products.edit_attributes": true,
    "products.edit_selling_price": false,
    "products.edit_cost_price": false,
    "products.edit_barcode_stocked": false,
    "products.set_barcode_unstocked": true,
    "products.deactivate": false,
    "products.add_master_values": true,
    "products.manage_master_values": false,
    "products.print_labels": true,
    "product.create": false,
    "product.edit": false,
    "product.price.edit": false,
    "product.barcode.print": true,

    // Inventory
    "inventory.stock_check": true,
    "inventory.cost_valuation_adjust": false,
    "inventory.movements_own_branch": false,
    "inventory.view": false,
    "inventory.adjust": false,
    "inventory.count": false,
    "inventory.cost.view": false,

    // Transfers
    "transfers.quick": true,
    "transfers.formal_dispatch_receive": true, // Scoped to own branch
    "transfer.request": false,
    "transfer.approve": false,
    "transfer.dispatch": true,
    "transfer.receive": true,
    "transfer.cancel": false,

    // Purchasing
    "purchasing.cash_bill.create": true,
    "purchasing.cheque.issue": true,
    "purchasing.credit_or_bank.create": false,
    "purchasing.suppliers.add": true,
    "purchasing.suppliers.view_basic": true,
    "purchasing.suppliers.manage_ledger_cheques": false,
    "purchasing.bills.view_all": false,
    "purchasing.bills.view_own": true,
    "purchase.view": false,
    "purchase.inward.view": false,
    "purchase.create": true,
    "purchase.cancel": false,

    // Repairs
    "repairs.receive_update_deliver": true,
    "repairs.edit_price_or_cancel": false,
    "repair.receive": true,
    "repair.update": true,
    "repair.collect": true,
    "repair.cancel": false,
    "repair.price.edit": false,

    // Employees & Payroll
    "employees.manage": false,

    // Users
    "users.manage": false,
    "user.manage": false,

    // Reports, Inbox, Settings, Audit
    "reports.view_all": false,
    "reports.view_own": true,
    "reports.view.outlet": false,
    "reports.view.all": false,
    "reports.financial.view": false,
    "review_inbox.view": false,
    "settings.manage": false,
    "audit.view": false,

    // Returns
    "return.create": true,
    "return.approve": false,
    "return.cash_refund": false,
    "return.override_window": false,
  },
};

/**
 * Universal authorization check function. Enforced across both UI and data service functions.
 */
export function can(
  user: UserProfile | { role: UserRole; allowedShopIds?: string[]; active?: boolean } | null | undefined,
  permission: PermissionKey,
  context?: PermissionContext
): boolean {
  if (!user || user.active === false) return false;

  const roleMap = ROLE_PERMISSIONS[user.role];
  if (!roleMap) return false;

  const isAllowed = roleMap[permission] ?? false;
  if (!isAllowed) return false;

  // Context-specific validations
  if (context) {
    // Barcode editing rule: If item has stock or sales, cashier cannot edit it
    if (permission === "products.set_barcode_unstocked" && context.hasStockOrSales) {
      return user.role === "SUPER_ADMIN" || user.role === "SHOP_MANAGER";
    }

    // Branch scoping check
    if (context.shopId && user.role !== "SUPER_ADMIN") {
      if (user.allowedShopIds && !user.allowedShopIds.includes(context.shopId)) {
        return false;
      }
    }

    // Purchases own bills check
    if (permission === "purchasing.bills.view_own" && context.isOwnBill === false && user.role !== "SUPER_ADMIN") {
      return false;
    }
  }

  return true;
}

/**
 * Legacy support wrapper for hasPermission
 */
export function hasPermission(
  role: UserRole,
  permission: PermissionKey,
  userProfile?: UserProfile | null
): boolean {
  return can(userProfile || { role, active: true }, permission);
}

export function canAccessOutlet(user: UserProfile | null | undefined, shopId: string): boolean {
  if (!user || !user.active) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return user.allowedShopIds.includes(shopId);
}

export function canViewCostPrice(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Module visibility for Sidebar and Mobile Navigation per Section 2.2
 */
export function isModuleVisible(role: UserRole, moduleId: string): boolean {
  switch (moduleId) {
    case "pos":
      // Super Admin: Hidden. Cashier: Yes. Manager: Yes.
      return role !== "SUPER_ADMIN";

    case "shifts":
      // Removed for everyone in Change Request 02
      return false;

    case "invoices":
    case "returns":
    case "repairs":
    case "transfers":
      // All active roles see invoices (own vs all), returns, repairs, and branch transfers
      return true;

    case "customers":
      // Customers & Credit is visible to everyone
      return true;

    case "inventory":
    case "products":
    case "purchases":
      // Visible to all roles (cashiers get scoped/read-only views: Stock Check, Catalog Quick Add, Cashier Inward)
      return true;

    case "suppliers":
    case "employees":
    case "reviewInbox":
    case "admin":
    case "dayEndStatus":
      // Strictly Super Admin only
      return role === "SUPER_ADMIN";

    case "reports":
      // Full reports view is for Super Admin; Cashier uses "My day summary" on Invoices page
      return role === "SUPER_ADMIN";

    case "dailyCash":
      return true;

    default:
      return false;
  }
}

/**
 * Declarative React Authorization Guard Component
 */
export function Can({
  user,
  I,
  this: context,
  children,
  fallback = null,
}: {
  user?: UserProfile | null;
  I: PermissionKey;
  this?: PermissionContext;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactElement | null {
  if (!can(user, I, context)) {
    return fallback ? React.createElement(React.Fragment, null, fallback) : null;
  }
  return React.createElement(React.Fragment, null, children);
}

/**
 * React Hook for checking permissions with current user context
 */
export function usePermission(
  currentUser: UserProfile | null | undefined,
  permission: PermissionKey,
  context?: PermissionContext
): boolean {
  return React.useMemo(() => {
    return can(currentUser, permission, context);
  }, [currentUser, permission, context]);
}
