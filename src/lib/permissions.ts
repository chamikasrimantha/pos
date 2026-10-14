// src/lib/permissions.ts
// Centralized permissions and role-based access control engine
import { UserRole, UserProfile } from "@/types";

export type PermissionKey =
  // POS
  | "pos.access"
  | "pos.sale.create"
  | "pos.discount.apply"
  | "pos.sale.cancel"
  | "pos.invoice.reprint"
  | "pos.history.view"
  // Shifts & Drawer
  | "shift.open"
  | "shift.close"
  | "shift.view.own"
  | "shift.view.all"
  | "shift.force_close"
  | "shift.variance.approve"
  | "cashdrawer.movement.create"
  // Returns
  | "return.create"
  | "return.approve"
  | "return.cash_refund"
  | "return.override_window"
  // Repairs
  | "repair.receive"
  | "repair.update"
  | "repair.collect"
  | "repair.cancel"
  | "repair.price.edit"
  // Inventory
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.count"
  | "inventory.count.approve"
  | "inventory.cost.view"
  // Products
  | "product.create"
  | "product.edit"
  | "product.price.edit"
  | "product.barcode.print"
  // Transfers
  | "transfer.request"
  | "transfer.approve"
  | "transfer.dispatch"
  | "transfer.receive"
  | "transfer.cancel"
  // Purchasing
  | "purchase.view"
  | "purchase.inward.view"
  | "purchase.create"
  | "purchase.cancel"
  // Suppliers & Cheques (SUPER ADMIN ONLY)
  | "supplier.view"
  | "supplier.manage"
  | "supplier.ledger.view"
  | "supplier.payment.create"
  | "cheque.manage"
  | "cheque.reversal.authorize"
  // Reports
  | "reports.view.outlet"
  | "reports.view.all"
  | "reports.financial.view"
  // Admin & System
  | "user.manage"
  | "settings.manage"
  | "audit.view";

// Baseline permissions map per role according to Specification Section 5.4
const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  SUPER_ADMIN: [
    "pos.access",
    "pos.sale.create",
    "pos.discount.apply",
    "pos.sale.cancel",
    "pos.invoice.reprint",
    "pos.history.view",
    "shift.open",
    "shift.close",
    "shift.view.own",
    "shift.view.all",
    "shift.force_close",
    "shift.variance.approve",
    "cashdrawer.movement.create",
    "return.create",
    "return.approve",
    "return.cash_refund",
    "return.override_window",
    "repair.receive",
    "repair.update",
    "repair.collect",
    "repair.cancel",
    "repair.price.edit",
    "inventory.view",
    "inventory.adjust",
    "inventory.count",
    "inventory.count.approve",
    "inventory.cost.view",
    "product.create",
    "product.edit",
    "product.price.edit",
    "product.barcode.print",
    "transfer.request",
    "transfer.approve",
    "transfer.dispatch",
    "transfer.receive",
    "transfer.cancel",
    "purchase.view",
    "purchase.inward.view",
    "purchase.create",
    "purchase.cancel",
    "supplier.view",
    "supplier.manage",
    "supplier.ledger.view",
    "supplier.payment.create",
    "cheque.manage",
    "cheque.reversal.authorize",
    "reports.view.outlet",
    "reports.view.all",
    "reports.financial.view",
    "user.manage",
    "settings.manage",
    "audit.view",
  ],

  SHOP_MANAGER: [
    "pos.access",
    "pos.sale.create",
    "pos.discount.apply",
    "pos.sale.cancel",
    "pos.invoice.reprint",
    "pos.history.view",
    "shift.open",
    "shift.close",
    "shift.view.own",
    "shift.view.all",
    "shift.variance.approve",
    "cashdrawer.movement.create",
    "return.create",
    "return.approve",
    "return.cash_refund",
    "repair.receive",
    "repair.update",
    "repair.collect",
    "repair.cancel",
    "repair.price.edit",
    "inventory.view",
    "inventory.count",
    "product.barcode.print",
    "transfer.request",
    "transfer.approve",
    "transfer.dispatch",
    "transfer.receive",
    "transfer.cancel",
    "purchase.inward.view",
    "reports.view.outlet",
  ],

  CASHIER: [
    "pos.access",
    "pos.sale.create",
    "pos.invoice.reprint",
    "shift.open",
    "shift.close",
    "shift.view.own",
    "return.create",
    "repair.receive",
    "repair.collect",
  ],
};

export function hasPermission(
  role: UserRole,
  permission: PermissionKey,
  userProfile?: UserProfile | null
): boolean {
  if (role === "SUPER_ADMIN") return true;

  // Check grantable overrides
  if (userProfile) {
    if (permission === "purchase.create" && userProfile.canCreatePurchase) {
      return true;
    }
  }

  const rolePerms = ROLE_PERMISSIONS[role];
  return rolePerms ? rolePerms.includes(permission) : false;
}

export function canAccessOutlet(user: UserProfile, shopId: string): boolean {
  if (!user || !user.active) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return user.allowedShopIds.includes(shopId);
}

export function canViewCostPrice(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

// Module visibility for Sidebar and Mobile Navigation
export function isModuleVisible(role: UserRole, moduleId: string): boolean {
  if (role === "SUPER_ADMIN") return true;

  switch (moduleId) {
    case "pos":
    case "shifts":
    case "returns":
    case "repairs":
      return true; // All roles see operational desk modules

    case "transfers":
    case "inventory":
    case "products":
    case "purchases":
    case "reports":
      return role === "SHOP_MANAGER"; // Managers see inventory, transfers, catalog, inward, reports

    case "suppliers":
    case "admin":
      return false; // Strictly SUPER_ADMIN only

    default:
      return false;
  }
}
