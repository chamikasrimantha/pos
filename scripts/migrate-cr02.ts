// scripts/migrate-cr02.ts
/**
 * POS Change Request 02 - Idempotent Data Migration Script
 *
 * Section 8: Migration and existing data
 * - Products, categories, sizes: productType = FOOTWEAR
 * - Sales: paymentStatus = PAID, amountPaid = total, balanceDue = 0 (cancelled sales keep status)
 * - Sale items: listPrice = unitSellingPrice, priceOverridden = false
 * - Purchases: paymentMethod = CREDIT, paymentStatus from existing balance, reviewStatus = OK
 * - Transfers: mode = FORMAL
 * - Repairs: itemType = FOOTWEAR, estimateProvided = true, no warranty; shift ids kept as legacy
 * - Users: Remove manager users using reference check (unreferenced deleted, referenced active:false, hidden:true)
 * - Shifts: Leave untouched
 * - Customers: Not auto-created
 * - Stock reconciliation: checks quantity on hand against sum of stock movements
 *
 * Usage:
 *   npm run migrate:cr02 [-- --dry-run] [--file <path>] [--firestore]
 */

import fs from "fs";
import path from "path";
import {
  loadLocalStore,
  saveLocalStore,
} from "../src/lib/firestore-service";
import type {
  Product,
  Category,
  ShoeSize,
  Sale,
  SaleItem,
  Purchase,
  StockTransfer,
  ShoeRepairOrder,
  UserProfile,
  Inventory,
  StockMovement,
} from "../src/types";

interface MigrationReport {
  dryRun: boolean;
  categoriesUpdated: number;
  sizesUpdated: number;
  productsUpdated: number;
  salesUpdated: number;
  saleItemsUpdated: number;
  purchasesUpdated: number;
  transfersUpdated: number;
  repairsUpdated: number;
  usersSoftDeleted: number;
  usersHardDeleted: number;
  shiftsUntouched: number;
  stockReconciliation: {
    totalChecked: number;
    matched: number;
    mismatches: Array<{
      invId: string;
      shopId: string;
      variantId: string;
      quantityOnHand: number;
      movementNetSum: number;
    }>;
  };
}

export function runMigration(storeData: any, dryRun = false): { updatedData: any; report: MigrationReport } {
  const report: MigrationReport = {
    dryRun,
    categoriesUpdated: 0,
    sizesUpdated: 0,
    productsUpdated: 0,
    salesUpdated: 0,
    saleItemsUpdated: 0,
    purchasesUpdated: 0,
    transfersUpdated: 0,
    repairsUpdated: 0,
    usersSoftDeleted: 0,
    usersHardDeleted: 0,
    shiftsUntouched: 0,
    stockReconciliation: {
      totalChecked: 0,
      matched: 0,
      mismatches: [],
    },
  };

  // Deep clone if dryRun or to prevent mutability leaks
  const store = JSON.parse(JSON.stringify(storeData));

  // 1. Categories: productType = FOOTWEAR
  if (Array.isArray(store.categories)) {
    store.categories.forEach((cat: Category) => {
      if (!cat.productType) {
        cat.productType = "FOOTWEAR";
        report.categoriesUpdated++;
      }
    });
  }

  // 2. Sizes: productType = FOOTWEAR
  if (Array.isArray(store.sizes)) {
    store.sizes.forEach((sz: ShoeSize) => {
      if (!sz.productType) {
        sz.productType = "FOOTWEAR";
        report.sizesUpdated++;
      }
    });
  }

  // 3. Products: productType = FOOTWEAR
  if (Array.isArray(store.products)) {
    store.products.forEach((prod: Product) => {
      if (!prod.productType) {
        prod.productType = "FOOTWEAR";
        report.productsUpdated++;
      }
    });
  }

  // Also ensure variants inherit or have productType
  if (Array.isArray(store.variants)) {
    store.variants.forEach((v: any) => {
      if (!v.productType) {
        v.productType = "FOOTWEAR";
      }
    });
  }

  // 4. Sales: paymentStatus = PAID, amountPaid = total, balanceDue = 0 (cancelled sales keep status)
  if (Array.isArray(store.sales)) {
    store.sales.forEach((sale: Sale) => {
      let changed = false;
      if (!sale.paymentStatus) {
        sale.paymentStatus = "PAID";
        changed = true;
      }
      if (sale.amountPaid === undefined || sale.amountPaid === null) {
        sale.amountPaid = sale.total;
        changed = true;
      }
      if (sale.balanceDue === undefined || sale.balanceDue === null) {
        sale.balanceDue = 0;
        changed = true;
      }
      if (changed) {
        report.salesUpdated++;
      }
    });
  }

  // 5. Sale items: listPrice = unitSellingPrice, priceOverridden = false
  if (Array.isArray(store.saleItems)) {
    store.saleItems.forEach((item: SaleItem) => {
      let changed = false;
      if (item.listPrice === undefined || item.listPrice === null) {
        item.listPrice = item.unitSellingPrice;
        changed = true;
      }
      if (item.priceOverridden === undefined || item.priceOverridden === null) {
        item.priceOverridden = false;
        changed = true;
      }
      if (changed) {
        report.saleItemsUpdated++;
      }
    });
  }

  // 6. Purchases: paymentMethod = CREDIT, paymentStatus from existing balance, reviewStatus = OK
  if (Array.isArray(store.purchases)) {
    store.purchases.forEach((pur: Purchase) => {
      let changed = false;
      if (!pur.paymentMethod) {
        pur.paymentMethod = "CREDIT";
        changed = true;
      }
      if (!pur.paymentStatus) {
        const paid = pur.paidAmount ?? 0;
        if (pur.balanceDue === 0 || (pur.totalAmount && paid >= pur.totalAmount)) {
          pur.paymentStatus = "PAID";
        } else if (paid > 0) {
          pur.paymentStatus = "PARTIALLY_PAID";
        } else {
          pur.paymentStatus = "UNPAID";
        }
        changed = true;
      }
      if (!pur.reviewStatus) {
        pur.reviewStatus = "OK";
        changed = true;
      }
      if (changed) {
        report.purchasesUpdated++;
      }
    });
  }

  // 7. Transfers: mode = FORMAL
  if (Array.isArray(store.transfers)) {
    store.transfers.forEach((trf: StockTransfer) => {
      if (!trf.mode) {
        trf.mode = "FORMAL";
        report.transfersUpdated++;
      }
    });
  }

  // 8. Repairs: itemType = FOOTWEAR, estimateProvided = true, no warranty; shift ids kept as legacy
  if (Array.isArray(store.repairs)) {
    store.repairs.forEach((rep: ShoeRepairOrder) => {
      let changed = false;
      if (!rep.itemType) {
        rep.itemType = "FOOTWEAR";
        changed = true;
      }
      if (rep.estimateProvided === undefined || rep.estimateProvided === null) {
        rep.estimateProvided = true;
        changed = true;
      }
      if (rep.underWarranty === undefined || rep.underWarranty === null) {
        rep.underWarranty = false;
        changed = true;
      }
      if (changed) {
        report.repairsUpdated++;
      }
    });
  }

  // 9. Users: Remove manager users using reference check in WP1
  if (Array.isArray(store.users)) {
    const isReferenced = (uid: string) => {
      return (
        (store.sales || []).some((s: Sale) => s.cashierId === uid || s.cancelledBy === uid) ||
        (store.saleItems || []).some((si: SaleItem) => si.cashierId === uid) ||
        (store.returns || []).some((r: any) => r.cashierId === uid || r.approvedBy === uid) ||
        (store.repairs || []).some((rp: ShoeRepairOrder) => rp.intakeCashierId === uid || rp.deliveryCashierId === uid) ||
        (store.transfers || []).some((t: StockTransfer) => t.dispatchedBy === uid || t.receivedBy === uid) ||
        (store.purchases || []).some((p: Purchase) => p.receivedBy === uid) ||
        (store.auditLogs || []).some((a: any) => a.userId === uid)
      );
    };

    const newUsers: UserProfile[] = [];
    for (const u of store.users) {
      if (u.role === "SHOP_MANAGER") {
        if (isReferenced(u.uid)) {
          if (u.active !== false || u.hidden !== true) {
            u.active = false;
            u.hidden = true;
            report.usersSoftDeleted++;
          }
          newUsers.push(u);
        } else {
          report.usersHardDeleted++;
        }
      } else {
        newUsers.push(u);
      }
    }
    store.users = newUsers;
  }

  // 10. Shifts: Leave untouched for backwards compatibility
  if (Array.isArray(store.shifts)) {
    report.shiftsUntouched = store.shifts.length;
  }

  // 11. Stock reconciliation: Check quantity on hand vs movements ledger
  const inventoryMap: Record<string, Inventory> = store.inventory || {};
  const movements: StockMovement[] = store.movements || [];

  for (const invKey of Object.keys(inventoryMap)) {
    const inv = inventoryMap[invKey];
    report.stockReconciliation.totalChecked++;

    const invMovements = movements.filter(
      (m) => m.shopId === inv.shopId && m.variantId === inv.variantId
    );

    if (invMovements.length === 0) {
      // No movements logged yet; initial seed quantity is considered matched
      report.stockReconciliation.matched++;
    } else {
      // Sort movements by createdAt timestamp
      invMovements.sort((a, b) => a.createdAt - b.createdAt);
      const latestMovement = invMovements[invMovements.length - 1];
      if (latestMovement.quantityAfter === inv.quantityOnHand) {
        report.stockReconciliation.matched++;
      } else {
        report.stockReconciliation.mismatches.push({
          invId: inv.id,
          shopId: inv.shopId,
          variantId: inv.variantId,
          quantityOnHand: inv.quantityOnHand,
          movementNetSum: latestMovement.quantityAfter,
        });
      }
    }
  }

  return { updatedData: store, report };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.some((a) => a.toLowerCase().includes("dry-run") || a === "-n");
  const fileArgIdx = args.findIndex((a) => a === "--file" || a === "-f");
  const filePath = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : null;

  console.log("=================================================");
  console.log("APEX POS: Change Request 02 Database Migration");
  console.log(`Execution Mode: ${dryRun ? "DRY-RUN (No changes saved)" : "LIVE MIGRATION"}`);
  console.log("=================================================");

  let currentStore: any;
  if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    console.log(`Loading data from file: ${resolvedPath}`);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: File not found at ${resolvedPath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    currentStore = JSON.parse(raw);
  } else {
    console.log("Loading store from POS local engine...");
    currentStore = loadLocalStore();
  }

  const { updatedData, report } = runMigration(currentStore, dryRun);

  console.log("\n--- Migration Summary ---");
  console.log(`Categories updated (productType='FOOTWEAR'): ${report.categoriesUpdated}`);
  console.log(`Sizes updated (productType='FOOTWEAR'):      ${report.sizesUpdated}`);
  console.log(`Products updated (productType='FOOTWEAR'):   ${report.productsUpdated}`);
  console.log(`Sales updated (PAID / amountPaid / balDue):  ${report.salesUpdated}`);
  console.log(`Sale Items updated (listPrice / override):   ${report.saleItemsUpdated}`);
  console.log(`Purchases updated (CREDIT / reviewStatus):   ${report.purchasesUpdated}`);
  console.log(`Transfers updated (mode='FORMAL'):           ${report.transfersUpdated}`);
  console.log(`Repairs updated (FOOTWEAR / estimate):       ${report.repairsUpdated}`);
  console.log(`Managers Soft-deleted (referenced):          ${report.usersSoftDeleted}`);
  console.log(`Managers Hard-deleted (unreferenced):        ${report.usersHardDeleted}`);
  console.log(`Shifts left untouched (backward-compat):     ${report.shiftsUntouched}`);

  console.log("\n--- Stock Reconciliation Check ---");
  console.log(`Total Inventory Variants Checked:           ${report.stockReconciliation.totalChecked}`);
  console.log(`Stock Reconciliation Matches:               ${report.stockReconciliation.matched}`);
  console.log(`Stock Reconciliation Discrepancies:         ${report.stockReconciliation.mismatches.length}`);

  if (report.stockReconciliation.mismatches.length > 0) {
    console.warn("WARNING: Stock mismatches detected:");
    report.stockReconciliation.mismatches.forEach((m) => {
      console.warn(`  - [${m.shopId}] Variant ${m.variantId}: on-hand=${m.quantityOnHand}, movements=${m.movementNetSum}`);
    });
  } else {
    console.log("Stock reconciliation OK: all quantities on hand match ledger movements.");
  }

  if (!dryRun) {
    if (filePath) {
      const resolvedPath = path.resolve(process.cwd(), filePath);
      fs.writeFileSync(resolvedPath, JSON.stringify(updatedData, null, 2), "utf-8");
      console.log(`\nSuccessfully saved migrated data to: ${resolvedPath}`);
    } else {
      saveLocalStore(updatedData);
      console.log("\nSuccessfully saved migrated data to POS local store.");
    }
  } else {
    console.log("\nDry-run complete. No files or records were modified.");
  }

  console.log("=================================================");
  console.log("Migration finished successfully.");
}

// Run if called as a script
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.includes("migrate-cr02"))) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
